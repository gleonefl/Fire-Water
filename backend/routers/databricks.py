"""
Router de integração com Databricks para AquaCities 3D.

Endpoints:
  POST /api/db/store-analysis   — salva avaliação de risco
  GET  /api/db/history          — busca histórico de uma região
  GET  /api/db/analytics        — resumo analítico (últimos 30 dias)
  GET  /api/db/status           — status da conexão Databricks
  GET  /api/db/setup-ddl        — retorna DDL para criar tabelas
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from services.databricks_service import (
    is_configured,
    get_flood_history,
    get_fire_history,
    save_risk_assessment,
    get_analytics_summary,
    SETUP_DDL,
)

router = APIRouter()


class RiskAssessmentIn(BaseModel):
    lat: float = Field(..., description="Latitude")
    lon: float = Field(..., description="Longitude")
    flood_risk: float = Field(0, ge=0, le=1)
    fire_risk: float = Field(0, ge=0, le=1)
    commercial_score: float = Field(0, ge=0, le=1)
    water_level: float = Field(0, ge=0)


class HistoryQuery(BaseModel):
    lat: float = -21.1775
    lon: float = -47.8099
    radius_km: float = 1.0


@router.get("/status")
async def db_status():
    """Retorna status da conexão Databricks."""
    configured = is_configured()
    return {
        "configured": configured,
        "message": (
            "Databricks conectado"
            if configured
            else "Databricks não configurado — defina DATABRICKS_HOST e DATABRICKS_TOKEN no .env"
        ),
    }


@router.post("/store-analysis")
async def store_analysis(data: RiskAssessmentIn):
    """Salva avaliação de risco no Databricks."""
    if not is_configured():
        # Quando Databricks não está configurado, aceita mas avisa
        return {
            "stored": False,
            "message": "Databricks não configurado — dados não persistidos",
            "data": data.model_dump(),
        }

    success = await save_risk_assessment(data.model_dump())
    if not success:
        raise HTTPException(status_code=500, detail="Falha ao salvar no Databricks")

    return {"stored": True, "message": "Avaliação salva com sucesso"}


@router.get("/history")
async def get_history(lat: float = -21.1775, lon: float = -47.8099, radius_km: float = 1.0):
    """Busca histórico de eventos na região."""
    if not is_configured():
        # Retorna dados simulados para demo
        return {
            "configured": False,
            "flood_events": _simulate_flood_history(),
            "fire_events": _simulate_fire_history(),
            "message": "Databricks offline — dados simulados para demonstração",
        }

    floods = await get_flood_history(lat, lon, radius_km)
    fires = await get_fire_history(lat, lon, radius_km)

    return {
        "configured": True,
        "flood_events": floods,
        "fire_events": fires,
    }


@router.get("/analytics")
async def analytics():
    """Resumo analítico dos últimos 30 dias."""
    if not is_configured():
        return {
            "configured": False,
            "summary": {
                "total_assessments": 42,
                "avg_flood_risk": 0.38,
                "avg_fire_risk": 0.22,
                "avg_commercial_score": 0.71,
                "max_flood_risk": 0.92,
                "min_flood_risk": 0.05,
            },
            "message": "Databricks offline — dados simulados",
        }

    summary = await get_analytics_summary()
    return {"configured": True, "summary": summary}


@router.get("/setup-ddl")
async def setup_ddl():
    """Retorna o DDL SQL para criar tabelas no Databricks."""
    return {"ddl": SETUP_DDL, "instructions": [
        "1. Acesse community.cloud.databricks.com",
        "2. Crie um Personal Access Token em Settings > Developer",
        "3. Abra um Notebook SQL e execute o DDL abaixo",
        "4. Configure as variáveis no arquivo .env do backend",
        "5. Reinicie o backend",
    ]}


# ── Dados simulados para quando Databricks não está configurado ──────────────
def _simulate_flood_history():
    import random
    from datetime import date, timedelta

    events = []
    for i in range(8):
        d = date.today() - timedelta(days=random.randint(30, 365))
        events.append({
            "event_date": str(d),
            "water_level_m": round(random.uniform(0.5, 3.5), 1),
            "precipitation_mm": round(random.uniform(40, 180), 0),
            "affected_area_km2": round(random.uniform(0.1, 2.5), 2),
            "severity": random.choice(["low", "medium", "high", "critical"]),
        })
    return sorted(events, key=lambda x: x["event_date"], reverse=True)


def _simulate_fire_history():
    import random
    from datetime import date, timedelta

    events = []
    for i in range(5):
        d = date.today() - timedelta(days=random.randint(30, 200))
        events.append({
            "event_date": str(d),
            "fire_type": random.choice(["vegetal", "urbano", "industrial"]),
            "area_burned_ha": round(random.uniform(0.1, 15), 1),
            "response_time_min": random.randint(8, 45),
            "severity": random.choice(["low", "medium", "high"]),
        })
    return sorted(events, key=lambda x: x["event_date"], reverse=True)
