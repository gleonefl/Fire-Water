from fastapi import APIRouter, Query
from models.schemas import CommercialViability
from services.elevation import get_elevation
from services.precipitation import get_precipitation_history
from services.risk_calculator import (
    calculate_risk,
    calculate_commercial_viability,
    nearest_water_distance,
    classify_zone,
    IMPERMEABILITY_ZONES,
)
import asyncio

router = APIRouter()

# Pontos comerciais de referência em Ribeirão Preto (dados simulados)
COMMERCIAL_HUBS = [
    {"name": "Shopping Iguatemi", "lat": -21.1896, "lon": -47.8225, "segment": "varejo"},
    {"name": "Shopping Santa Úrsula", "lat": -21.1612, "lon": -47.7981, "segment": "varejo"},
    {"name": "Av. Independência", "lat": -21.1734, "lon": -47.8196, "segment": "comercio"},
    {"name": "Centro Empresarial", "lat": -21.1770, "lon": -47.8140, "segment": "corporativo"},
    {"name": "Bairro Jardim América", "lat": -21.1950, "lon": -47.8150, "segment": "residencial"},
]


@router.get("/viability", response_model=CommercialViability, summary="Viabilidade comercial")
async def get_commercial_viability(
    lat: float = Query(..., ge=-90, le=90),
    lon: float = Query(..., ge=-180, le=180),
    address: str = Query(default=None),
):
    """
    Calcula o score de viabilidade comercial para um ponto.

    Combina risco hídrico + indicadores urbanos de Ribeirão Preto.
    """
    altitude, precip_data = await asyncio.gather(
        get_elevation(lat, lon),
        get_precipitation_history(lat, lon, days=7),
    )

    distance_km = nearest_water_distance(lat, lon)
    zone = classify_zone(lat, lon)
    impermeability = IMPERMEABILITY_ZONES.get(zone, 0.75)

    risk = calculate_risk(
        altitude=altitude,
        precipitation_mm=precip_data["total_7d_mm"],
        distance_to_water_km=distance_km,
        impermeability=impermeability,
    )

    commercial = calculate_commercial_viability(
        flood_risk=risk["risk_score"],
        distance_to_water_km=distance_km,
        altitude=altitude,
    )

    viability_score = commercial["viability_score"]
    if viability_score > 0.70:
        status = "EXCELENTE"
    elif viability_score > 0.50:
        status = "BOM"
    elif viability_score > 0.30:
        status = "MODERADO"
    else:
        status = "RUIM"

    return CommercialViability(
        lat=lat,
        lon=lon,
        address=address,
        viability_score=viability_score,
        flood_risk=risk["risk_score"],
        foot_traffic_index=_estimate_foot_traffic(lat, lon),
        competition_density=_estimate_competition(lat, lon),
        recommendation=commercial["recommendation"],
        status=status,
    )


@router.get("/hubs", summary="Pontos comerciais de referência")
def get_commercial_hubs():
    """Retorna pontos comerciais principais de Ribeirão Preto."""
    return {"hubs": COMMERCIAL_HUBS}


def _estimate_foot_traffic(lat: float, lon: float) -> float:
    """Estima fluxo de pedestres (0-1) baseado na proximidade ao centro."""
    from services.risk_calculator import haversine_km
    dist = haversine_km(lat, lon, -21.1775, -47.8099)
    return round(max(0.0, min(1.0, 1.0 - dist / 8.0)), 4)


def _estimate_competition(lat: float, lon: float) -> float:
    """Estima densidade de concorrência (0-1)."""
    from services.risk_calculator import haversine_km
    # Mais competição perto do centro e de shopping centers
    min_hub_dist = min(
        haversine_km(lat, lon, h["lat"], h["lon"]) for h in COMMERCIAL_HUBS
    )
    return round(max(0.0, min(1.0, 1.0 - min_hub_dist / 3.0)), 4)
