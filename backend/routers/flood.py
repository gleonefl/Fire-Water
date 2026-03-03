from fastapi import APIRouter, Query, HTTPException
from models.schemas import FloodRiskResponse
from services.elevation import get_elevation
from services.precipitation import get_precipitation_history
from services.risk_calculator import (
    calculate_risk,
    nearest_water_distance,
    classify_zone,
    IMPERMEABILITY_ZONES,
)

router = APIRouter()


@router.get("/risk", response_model=FloodRiskResponse, summary="Calcular risco de inundação")
async def get_flood_risk(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lon: float = Query(..., ge=-180, le=180, description="Longitude"),
    water_level: float = Query(default=0.0, ge=0, le=100, description="Nível de água simulado (m)"),
):
    """
    Calcula o risco de inundação para uma coordenada.

    Combina:
    - **Elevação** local (Mapbox Terrain-RGB / estimativa)
    - **Precipitação** dos últimos 7 dias (Open-Meteo)
    - **Distância** a corpos d'água
    - **Nível** de água simulado pelo slider
    """
    # Validação para área de Ribeirão Preto (opcional — remova para uso global)
    # if not (-22.0 <= lat <= -20.5 and -48.5 <= lon <= -47.0):
    #     raise HTTPException(400, "Coordenada fora da área de análise (Ribeirão Preto, SP)")

    # Paralelo: eleação + precipitação + distância
    import asyncio
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
        water_level=water_level,
        impermeability=impermeability,
    )

    return FloodRiskResponse(
        lat=lat,
        lon=lon,
        altitude=altitude,
        risk_score=risk["risk_score"],
        flood_probability=risk["flood_probability"],
        precipitation_7d=precip_data["total_7d_mm"],
        distance_to_water=distance_km,
        status=risk["status"],
        details={
            **risk["details"],
            "zone": zone,
            "water_level_simulated": water_level,
            "precipitation_max_daily": precip_data["max_daily_mm"],
        },
    )


@router.get("/precipitation", summary="Histórico de precipitação")
async def get_precipitation(
    lat: float = Query(default=-21.1775),
    lon: float = Query(default=-47.8099),
    days: int = Query(default=7, ge=1, le=30),
):
    """Retorna histórico de precipitação (Open-Meteo API)."""
    data = await get_precipitation_history(lat, lon, days)
    return {"lat": lat, "lon": lon, "precipitation": data}


@router.get("/elevation", summary="Elevação do terreno")
async def get_terrain_elevation(
    lat: float = Query(...),
    lon: float = Query(...),
):
    """Retorna a altitude estimada em metros para a coordenada."""
    altitude = await get_elevation(lat, lon)
    return {"lat": lat, "lon": lon, "altitude_m": altitude}
