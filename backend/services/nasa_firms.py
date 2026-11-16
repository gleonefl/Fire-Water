"""
NASA FIRMS active-fire detections for the Ribeirão Preto sugarcane belt.

With FIRMS_MAP_KEY, uses the area API:
https://firms.modaps.eosdis.nasa.gov/api/area/csv/{KEY}/{SOURCE}/{w,s,e,n}/{days}

Without a key, reads the public South America 7-day CSVs. Suomi NPP VIIRS is
tried first, then MODIS C6.1. NOAA-20 VIIRS is an extra public fallback because
the Suomi NPP 7-day file is sometimes published as a header only.
"""
from __future__ import annotations

import csv
import io
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# west, south, east, north — farmland around Ribeirão Preto, SP
BBOX = (-48.5, -21.8, -47.2, -20.6)
USER_AGENT = "AQUACITIES-3D/1.0 (NASA Space Apps; farmland fire monitor)"
CACHE_TTL_S = 600
MAX_FIRES = 80

AREA_SOURCES = (
    "VIIRS_SNPP_NRT",
    "VIIRS_NOAA20_NRT",
    "MODIS_NRT",
)

PUBLIC_SOURCES = (
    {
        "product": "VIIRS_SNPP_C2",
        "sensor": "VIIRS",
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_7d.csv",
    },
    {
        "product": "MODIS_C6_1",
        "sensor": "MODIS",
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_7d.csv",
    },
    {
        "product": "VIIRS_NOAA20_C2",
        "sensor": "VIIRS",
        "url": "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_7d.csv",
    },
)

_cache: dict[str, tuple[float, dict]] = {}


def _firms_key() -> str:
    key = (os.getenv("FIRMS_MAP_KEY") or "").strip()
    if not key or key.lower() in {"your_key_here", "seu_token", "changeme"}:
        return ""
    return key


def _in_bbox(lat: float, lon: float) -> bool:
    west, south, east, north = BBOX
    return west <= lon <= east and south <= lat <= north


def _sensor_for(product: str, satellite: str) -> str:
    name = f"{product} {satellite}".upper()
    if "MODIS" in name or satellite.upper() in {"A", "T"}:
        return "MODIS"
    return "VIIRS"


def _parse_csv(text: str, product: str, sensor: str | None = None) -> tuple[list[dict], int]:
    """Return (fires inside bbox, data rows in the file)."""
    if not text or "latitude" not in text.split("\n", 1)[0].lower():
        return [], 0

    fires: list[dict] = []
    rows = 0
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        if not row:
            continue
        rows += 1
        try:
            lat = float(row.get("latitude") or "")
            lon = float(row.get("longitude") or "")
        except ValueError:
            continue
        if not _in_bbox(lat, lon):
            continue
        frp_raw = row.get("frp")
        try:
            frp = float(frp_raw) if frp_raw not in (None, "") else None
        except ValueError:
            frp = None
        satellite = (row.get("satellite") or "").strip()
        fires.append(
            {
                "lat": round(lat, 5),
                "lon": round(lon, 5),
                "acq_date": (row.get("acq_date") or "").strip(),
                "acq_time": (row.get("acq_time") or "").strip(),
                "satellite": satellite,
                "confidence": (row.get("confidence") or "").strip(),
                "frp": None if frp is None else round(frp, 2),
                "sensor": sensor or _sensor_for(product, satellite),
                "product": product,
                "simulated": False,
            }
        )
    return fires, rows


def _dedupe(fires: list[dict]) -> list[dict]:
    """Collapse same-day detections within ~2 km, keeping the highest FRP."""
    best: dict[tuple, dict] = {}
    for fire in fires:
        key = (round(fire["lat"], 2), round(fire["lon"], 2), fire.get("acq_date") or "")
        current = best.get(key)
        if current is None or (fire.get("frp") or -1) > (current.get("frp") or -1):
            best[key] = fire
    ordered = sorted(best.values(), key=lambda f: (f.get("frp") or -1), reverse=True)
    return ordered


def _payload(
    *,
    ok: bool,
    mode: str,
    fires: list[dict],
    products: list[str],
    errors: list[str],
    file_rows: int,
    empty_products: list[str] | None = None,
) -> dict:
    deduped = _dedupe(fires) if ok else []
    return {
        "ok": ok,
        "source": "NASA FIRMS",
        "mode": mode,
        "products": products,
        "empty_products": empty_products or [],
        "bbox": {
            "west": BBOX[0],
            "south": BBOX[1],
            "east": BBOX[2],
            "north": BBOX[3],
        },
        "count": len(deduped),
        "fires": deduped[:MAX_FIRES],
        "truncated": len(deduped) > MAX_FIRES,
        "file_rows": file_rows,
        "simulated": False,
        "fallback": None if ok else "simulated",
        "errors": errors,
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "attribution": "Source: NASA FIRMS",
    }


async def _get_text(client: httpx.AsyncClient, url: str) -> str:
    resp = await client.get(url, headers={"User-Agent": USER_AGENT})
    resp.raise_for_status()
    return resp.text


async def _from_area_api(client: httpx.AsyncClient, key: str) -> dict | None:
    west, south, east, north = BBOX
    area = f"{west},{south},{east},{north}"
    fires: list[dict] = []
    products: list[str] = []
    errors: list[str] = []
    any_ok = False

    for source in AREA_SOURCES:
        url = f"https://firms.modaps.eosdis.nasa.gov/api/area/csv/{key}/{source}/{area}/5"
        try:
            text = await _get_text(client, url)
        except Exception as exc:
            errors.append(f"{source}: {exc.__class__.__name__}")
            continue
        parsed, rows = _parse_csv(text, source)
        if rows == 0 and "latitude" not in text[:80].lower():
            errors.append(f"{source}: non-csv response")
            continue
        any_ok = True
        products.append(source)
        fires.extend(parsed)

    if not any_ok:
        return None
    return _payload(ok=True, mode="area_api", fires=fires, products=products, errors=errors, file_rows=0)


async def _from_public_csv(client: httpx.AsyncClient) -> dict:
    fires: list[dict] = []
    products: list[str] = []
    empty_products: list[str] = []
    errors: list[str] = []
    file_rows = 0
    any_rows = False

    for source in PUBLIC_SOURCES:
        try:
            text = await _get_text(client, source["url"])
        except Exception as exc:
            errors.append(f"{source['product']}: {exc.__class__.__name__}")
            continue
        parsed, rows = _parse_csv(text, source["product"], source["sensor"])
        file_rows += rows
        if rows > 0:
            any_rows = True
            products.append(source["product"])
            fires.extend(parsed)
        else:
            # Header-only files (Suomi NPP 7-day has shipped this way) are not a regional zero.
            empty_products.append(source["product"])

    # A header-only file (Suomi NPP has shipped that way) is not a regional zero.
    if not any_rows:
        return _payload(
            ok=False,
            mode="unavailable",
            fires=[],
            products=products,
            errors=errors or ["public FIRMS CSVs were empty or unreachable"],
            file_rows=file_rows,
            empty_products=empty_products,
        )

    return _payload(
        ok=True,
        mode="public_csv",
        fires=fires,
        products=products,
        errors=errors,
        file_rows=file_rows,
        empty_products=empty_products,
    )


async def get_firms_fires() -> dict:
    """Active fires in the farmland bbox. Always returns a dict; never raises."""
    cache_key = "firms"
    cached = _cache.get(cache_key)
    now = time.time()
    if cached and (now - cached[0]) < CACHE_TTL_S:
        return cached[1]

    key = _firms_key()
    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(25.0, connect=8.0), follow_redirects=True) as client:
            result = None
            if key:
                result = await _from_area_api(client, key)
            if result is None:
                result = await _from_public_csv(client)
    except Exception as exc:
        logger.warning("NASA FIRMS request failed: %s", exc)
        result = _payload(
            ok=False,
            mode="unavailable",
            fires=[],
            products=[],
            errors=[exc.__class__.__name__],
            file_rows=0,
        )

    stamp = now if result.get("ok") else now - (CACHE_TTL_S - 60)
    _cache[cache_key] = (stamp, result)
    return result
