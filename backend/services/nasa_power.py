"""
NASA POWER agroclimatology for a farmland point.

Docs: https://power.larc.nasa.gov/docs/services/api/
No API key. Daily point service, community=AG.

The request window ends five days before today because POWER's daily
products lag a few days. Fill value -999 is ignored.
"""
from __future__ import annotations

import logging
import time
from datetime import date, timedelta

import httpx

logger = logging.getLogger(__name__)

POWER_URL = "https://power.larc.nasa.gov/api/temporal/daily/point"
PARAMETERS = (
    "PRECTOTCORR",
    "T2M",
    "T2M_MAX",
    "RH2M",
    "GWETROOT",
    "GWETTOP",
    "ALLSKY_SFC_SW_DWN",
)
FILL = -999.0
LATENCY_DAYS = 5
CACHE_TTL_S = 600
_cache: dict[str, tuple[float, dict]] = {}

# 30-day equivalent thresholds for sugarcane around Ribeirão Preto.
# Rain stress uses mean daily precip × 30 so missing days are not treated as zero.
DROUGHT_RAIN_FULL_MM = 20.0    # 30-day equivalent at or below this → rain stress = 1
DROUGHT_RAIN_NONE_MM = 80.0    # at or above this → rain stress = 0
DROUGHT_SOIL_FULL = 0.20       # root-zone wetness at or below this → soil stress = 1
DROUGHT_SOIL_NONE = 0.45       # at or above this → soil stress = 0
HEAT_NONE_C = 32.0             # mean daily T2M_MAX at or below this → heat stress = 0
HEAT_FULL_C = 38.0             # at or above this → heat stress = 1
WET_RAIN_NONE_MM = 80.0        # 30-day equivalent at or below this → excess-rain = 0
WET_RAIN_FULL_MM = 200.0       # at or above this → excess-rain = 1
WET_TOP_NONE = 0.60            # surface wetness at or below this → saturation stress = 0
WET_TOP_FULL = 0.90            # at or above this → saturation stress = 1

METHOD = (
    "Farm Climate Risk compares two hazards over the requested window "
    "(ending 5 days ago; -999 fills ignored). "
    "Drought stress = 0.45*soil + 0.35*rain + 0.20*heat, where soil ramps "
    "from 0 at GWETROOT 0.45 to 1 at 0.20, rain ramps from 0 at 80 mm to 1 at "
    "20 mm (30-day equivalent = mean daily PRECTOTCORR × 30), and heat ramps "
    "from 0 at mean T2M_MAX 32°C to 1 at 38°C. "
    "Waterlogging = 0.60*rain + 0.40*surface, where rain ramps from 0 at 80 mm "
    "to 1 at 200 mm (same 30-day equivalent) and surface ramps from 0 at "
    "GWETTOP 0.60 to 1 at 0.90. "
    "Level uses the larger score: LOW < 0.25, MODERATE < 0.50, HIGH < 0.75, else SEVERE."
)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _ramp_up(value: float, none_at: float, full_at: float) -> float:
    if full_at == none_at:
        return 0.0
    return _clamp((value - none_at) / (full_at - none_at))


def _ramp_down(value: float, full_at: float, none_at: float) -> float:
    if none_at == full_at:
        return 0.0
    return _clamp((none_at - value) / (none_at - full_at))


def _mean(values: list[float]) -> float | None:
    if not values:
        return None
    return sum(values) / len(values)


def _round(value: float | None, digits: int = 2) -> float | None:
    if value is None:
        return None
    return round(value, digits)


def _level(score: float) -> str:
    if score < 0.25:
        return "LOW"
    if score < 0.50:
        return "MODERATE"
    if score < 0.75:
        return "HIGH"
    return "SEVERE"


def _window(days: int) -> tuple[date, date]:
    end = date.today() - timedelta(days=LATENCY_DAYS)
    start = end - timedelta(days=days - 1)
    return start, end


def _as_float(raw) -> float | None:
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if value <= FILL + 1:  # POWER fill is -999
        return None
    return value


def farm_climate_risk(summary: dict, days: int) -> dict:
    """Transparent drought-stress / waterlogging indicator. Never raises."""
    try:
        return _farm_climate_risk(summary, days)
    except Exception as exc:  # pragma: no cover - defensive
        logger.warning("farm climate risk failed: %s", exc)
        return {
            "level": "UNKNOWN",
            "primary": "unavailable",
            "drought_stress": None,
            "waterlogging": None,
            "components": {},
            "method": METHOD,
        }


def _farm_climate_risk(summary: dict, days: int) -> dict:
    gwetroot = summary.get("gwetroot_mean")
    gwettop = summary.get("gwettop_mean")
    tmax = summary.get("t2m_max_mean_c")
    precip_mean = summary.get("precip_mean_mm_day")

    precip_30d = None if precip_mean is None else precip_mean * 30.0

    components: dict[str, float | None] = {
        "soil_dry": None if gwetroot is None else round(_ramp_down(gwetroot, DROUGHT_SOIL_FULL, DROUGHT_SOIL_NONE), 3),
        "rain_dry": None if precip_30d is None else round(_ramp_down(precip_30d, DROUGHT_RAIN_FULL_MM, DROUGHT_RAIN_NONE_MM), 3),
        "heat": None if tmax is None else round(_ramp_up(tmax, HEAT_NONE_C, HEAT_FULL_C), 3),
        "rain_wet": None if precip_30d is None else round(_ramp_up(precip_30d, WET_RAIN_NONE_MM, WET_RAIN_FULL_MM), 3),
        "top_wet": None if gwettop is None else round(_ramp_up(gwettop, WET_TOP_NONE, WET_TOP_FULL), 3),
    }

    drought_parts = [
        (0.45, components["soil_dry"]),
        (0.35, components["rain_dry"]),
        (0.20, components["heat"]),
    ]
    wet_parts = [
        (0.60, components["rain_wet"]),
        (0.40, components["top_wet"]),
    ]

    def _weighted(parts: list[tuple[float, float | None]]) -> float | None:
        available = [(w, v) for w, v in parts if v is not None]
        if not available:
            return None
        weight = sum(w for w, _ in available)
        return round(sum(w * v for w, v in available) / weight, 3)

    drought = _weighted(drought_parts)
    waterlog = _weighted(wet_parts)

    if drought is None and waterlog is None:
        level = "UNKNOWN"
        primary = "unavailable"
        score = None
    else:
        drought_v = drought or 0.0
        water_v = waterlog or 0.0
        score = round(max(drought_v, water_v), 3)
        level = _level(score)
        if score < 0.25:
            primary = "favorable"
        elif drought_v >= water_v:
            primary = "drought_stress"
        else:
            primary = "waterlogging"

    return {
        "level": level,
        "primary": primary,
        "score": score,
        "drought_stress": drought,
        "waterlogging": waterlog,
        "precip_30d_equivalent_mm": _round(precip_30d, 1),
        "components": components,
        "thresholds": {
            "drought_gwetroot_none_to_full": [DROUGHT_SOIL_NONE, DROUGHT_SOIL_FULL],
            "drought_rain_30d_mm_none_to_full": [DROUGHT_RAIN_NONE_MM, DROUGHT_RAIN_FULL_MM],
            "heat_t2m_max_c_none_to_full": [HEAT_NONE_C, HEAT_FULL_C],
            "waterlog_rain_30d_mm_none_to_full": [WET_RAIN_NONE_MM, WET_RAIN_FULL_MM],
            "waterlog_gwettop_none_to_full": [WET_TOP_NONE, WET_TOP_FULL],
            "weights": {"drought": "0.45 soil + 0.35 rain + 0.20 heat", "waterlogging": "0.60 rain + 0.40 surface"},
            "levels": "LOW < 0.25 <= MODERATE < 0.50 <= HIGH < 0.75 <= SEVERE",
        },
        "method": METHOD,
        "days_requested": days,
    }


def _empty(lat: float, lon: float, days: int, error: str) -> dict:
    start, end = _window(days)
    return {
        "ok": False,
        "source": "NASA POWER",
        "community": "AG",
        "lat": lat,
        "lon": lon,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "days_requested": days,
        "latency_days": LATENCY_DAYS,
        "parameters": list(PARAMETERS),
        "daily": [],
        "summary": {},
        "farm_climate_risk": {
            "level": "UNKNOWN",
            "primary": "unavailable",
            "drought_stress": None,
            "waterlogging": None,
            "components": {},
            "method": METHOD,
        },
        "error": error,
        "attribution": "Source: NASA POWER",
    }


def _build(lat: float, lon: float, days: int, payload: dict) -> dict:
    parameter = (
        payload.get("properties", {}).get("parameter", {})
        if isinstance(payload, dict)
        else {}
    )
    if not isinstance(parameter, dict) or not parameter:
        return _empty(lat, lon, days, "NASA POWER returned no parameter block")

    by_date: dict[str, dict] = {}
    for name in PARAMETERS:
        series = parameter.get(name) or {}
        if not isinstance(series, dict):
            continue
        for raw_date, raw_value in series.items():
            key = str(raw_date)
            if len(key) != 8 or not key.isdigit():
                continue
            row = by_date.setdefault(key, {"date": f"{key[0:4]}-{key[4:6]}-{key[6:8]}"})
            row[name] = _as_float(raw_value)

    daily = [by_date[k] for k in sorted(by_date)]

    def col(name: str) -> list[float]:
        return [row[name] for row in daily if isinstance(row.get(name), float)]

    precip = col("PRECTOTCORR")
    t2m = col("T2M")
    tmax = col("T2M_MAX")
    rh = col("RH2M")
    root = col("GWETROOT")
    top = col("GWETTOP")
    solar = col("ALLSKY_SFC_SW_DWN")

    summary = {
        "precip_total_mm": _round(sum(precip), 1) if precip else None,
        "precip_mean_mm_day": _round(_mean(precip), 2),
        "t2m_mean_c": _round(_mean(t2m), 2),
        "t2m_max_mean_c": _round(_mean(tmax), 2),
        "t2m_max_peak_c": _round(max(tmax), 2) if tmax else None,
        "rh2m_mean_pct": _round(_mean(rh), 1),
        "gwetroot_mean": _round(_mean(root), 3),
        "gwettop_mean": _round(_mean(top), 3),
        "solar_mean_mj_m2_day": _round(_mean(solar), 2),
        "valid_days": {
            "PRECTOTCORR": len(precip),
            "T2M": len(t2m),
            "T2M_MAX": len(tmax),
            "RH2M": len(rh),
            "GWETROOT": len(root),
            "GWETTOP": len(top),
            "ALLSKY_SFC_SW_DWN": len(solar),
        },
        "units": {
            "PRECTOTCORR": "mm/day",
            "T2M": "°C",
            "T2M_MAX": "°C",
            "RH2M": "%",
            "GWETROOT": "fraction 0-1",
            "GWETTOP": "fraction 0-1",
            "ALLSKY_SFC_SW_DWN": "MJ/m^2/day",
        },
    }

    start, end = _window(days)
    return {
        "ok": True,
        "source": "NASA POWER",
        "community": "AG",
        "lat": lat,
        "lon": lon,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "days_requested": days,
        "latency_days": LATENCY_DAYS,
        "parameters": list(PARAMETERS),
        "daily": daily,
        "summary": summary,
        "farm_climate_risk": farm_climate_risk(summary, days),
        "error": None,
        "attribution": "Source: NASA POWER",
    }


async def get_power_daily(lat: float, lon: float, days: int = 30) -> dict:
    """Fetch POWER daily series. Always returns a dict; never raises."""
    days = max(1, min(int(days), 60))
    cache_key = f"{round(lat, 3)}:{round(lon, 3)}:{days}"
    cached = _cache.get(cache_key)
    if cached and (time.time() - cached[0]) < CACHE_TTL_S:
        return cached[1]

    start, end = _window(days)
    params = {
        "parameters": ",".join(PARAMETERS),
        "community": "AG",
        "longitude": lon,
        "latitude": lat,
        "start": start.strftime("%Y%m%d"),
        "end": end.strftime("%Y%m%d"),
        "format": "JSON",
    }

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(12.0, connect=8.0)) as client:
            resp = await client.get(POWER_URL, params=params)
            resp.raise_for_status()
            payload = resp.json()
        result = _build(lat, lon, days, payload)
    except Exception as exc:
        logger.warning("NASA POWER request failed: %s", exc)
        result = _empty(lat, lon, days, f"NASA POWER unavailable: {exc.__class__.__name__}")

    # Cache successes longer; cache failures briefly so a blip can recover.
    ttl_stamp = time.time() if result.get("ok") else time.time() - (CACHE_TTL_S - 60)
    _cache[cache_key] = (ttl_stamp, result)
    return result
