from pydantic import BaseModel, Field
from typing import Optional


class Coordinate(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")


class FloodRiskRequest(BaseModel):
    lat: float
    lon: float
    water_level: float = Field(default=0.0, ge=0, le=100, description="Nível de água simulado em metros")


class FloodRiskResponse(BaseModel):
    lat: float
    lon: float
    altitude: float
    risk_score: float = Field(..., ge=0, le=1, description="Score de risco de 0 a 1")
    flood_probability: int = Field(..., ge=0, le=100, description="Probabilidade de inundação em %")
    precipitation_7d: float = Field(..., description="Precipitação acumulada nos últimos 7 dias (mm)")
    distance_to_water: float = Field(..., description="Distância aproximada a corpos d'água (km)")
    status: str = Field(..., description="SEGURO | MODERADO | ALTO | CRÍTICO")
    details: Optional[dict] = None


class CommercialViability(BaseModel):
    lat: float
    lon: float
    address: Optional[str] = None
    viability_score: float = Field(..., ge=0, le=1)
    flood_risk: float
    foot_traffic_index: float
    competition_density: float
    recommendation: str
    status: str


class PrecipitationData(BaseModel):
    date: str
    precipitation_mm: float
    city: str = "Ribeirão Preto"
