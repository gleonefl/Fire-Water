"""
Calculadora de Risco de Inundação.

Fórmula base:
    Risco = (Precipitação × Coeficiente_Impermeabilidade) / Altitude

Fatores adicionais:
    - Distância a corpos d'água (Córrego Ribeirão Preto, Rio Pardo)
    - Histórico de precipitação (7 dias)
    - Nível de água simulado pelo usuário
"""
import math
from typing import Optional

# ──────────────────────────────────────────────────────────────────────────────
# Corpos d'água próximos a Ribeirão Preto (lat, lon)
# ──────────────────────────────────────────────────────────────────────────────
WATER_BODIES = [
    # Córrego Ribeirão Preto (trecho urbano)
    (-21.1700, -47.8050),
    (-21.1750, -47.8100),
    (-21.1800, -47.8200),
    # Represa Municipal
    (-21.2100, -47.8600),
    # Córrego Retiro Saudoso
    (-21.1900, -47.7900),
    # Rio Pardo (sul da cidade)
    (-21.3500, -47.7500),
]

# Coeficiente de impermeabilidade por tipo de uso do solo (estimado para RP)
IMPERMEABILITY_ZONES = {
    "centro": 0.92,     # Centro/Comercial — quase impermeável
    "bairros": 0.75,    # Bairros residenciais
    "periferias": 0.55, # Periferias / chácaras
    "parques": 0.20,    # Parques / áreas verdes
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Distância entre dois pontos em km (fórmula de Haversine)."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.asin(math.sqrt(a))


def nearest_water_distance(lat: float, lon: float) -> float:
    """Retorna a distância em km ao corpo d'água mais próximo."""
    distances = [haversine_km(lat, lon, wlat, wlon) for wlat, wlon in WATER_BODIES]
    return round(min(distances), 3)


def classify_zone(lat: float, lon: float) -> str:
    """Classifica a zona urbana com base no centroide de Ribeirão Preto."""
    dist_to_center = haversine_km(lat, lon, -21.1775, -47.8099)
    if dist_to_center < 1.5:
        return "centro"
    elif dist_to_center < 5.0:
        return "bairros"
    elif dist_to_center < 12.0:
        return "periferias"
    else:
        return "parques"


def calculate_risk(
    altitude: float,
    precipitation_mm: float,
    distance_to_water_km: float,
    water_level: float = 0.0,
    impermeability: Optional[float] = None,
) -> dict:
    """
    Calcula o score de risco de inundação.

    Args:
        altitude: Elevação do ponto em metros
        precipitation_mm: Precipitação acumulada dos últimos 7 dias (mm)
        distance_to_water_km: Distância ao corpo d'água mais próximo (km)
        water_level: Nível de água simulado pelo usuário (m)
        impermeability: Coeficiente de impermeabilidade (0-1)

    Returns:
        dict com risk_score (0-1), flood_probability (%), status e detalhes
    """
    if impermeability is None:
        # Impermeabilidade padrão para Ribeirão Preto urbano
        impermeability = 0.75

    # ── Componente 1: Fórmula base ─────────────────────────────────────────
    # Risco = (P × C_imp) / Altitude (normalizado)
    # Altitude esperada: 450–620m em RP
    altitude_normalized = max(altitude - 450, 1.0)  # remove base de 450m
    base_risk = (precipitation_mm * impermeability) / (altitude_normalized * 10)
    base_risk = min(base_risk, 1.0)

    # ── Componente 2: Proximidade a corpos d'água ──────────────────────────
    # Risco maior quando próximo (< 0.5km) e menor quando longe (> 5km)
    proximity_risk = max(0.0, 1.0 - (distance_to_water_km / 3.0))
    proximity_risk = min(proximity_risk, 1.0)

    # ── Componente 3: Nível de água simulado ──────────────────────────────
    # Se altitude < water_level, ponto está submerso
    submersion_risk = 0.0
    if water_level > 0:
        # Altitude relativa ao nível de mar de referência (~450m base RP)
        relative_alt = altitude - 450
        submersion_risk = max(0.0, min(1.0, (water_level - relative_alt) / 50.0))

    # ── Score final ponderado ─────────────────────────────────────────────
    risk_score = (
        base_risk * 0.40
        + proximity_risk * 0.25
        + submersion_risk * 0.35
    )
    risk_score = round(min(max(risk_score, 0.0), 1.0), 4)

    flood_probability = int(risk_score * 100)

    # Status
    if risk_score < 0.33:
        status = "SEGURO"
    elif risk_score < 0.60:
        status = "MODERADO"
    elif risk_score < 0.80:
        status = "ALTO"
    else:
        status = "CRÍTICO"

    return {
        "risk_score": risk_score,
        "flood_probability": flood_probability,
        "status": status,
        "details": {
            "base_risk": round(base_risk, 4),
            "proximity_risk": round(proximity_risk, 4),
            "submersion_risk": round(submersion_risk, 4),
            "impermeability_used": impermeability,
        },
    }


def calculate_commercial_viability(
    flood_risk: float,
    distance_to_water_km: float,
    altitude: float,
) -> dict:
    """
    Calcula o score de viabilidade comercial de um ponto.
    Combina risco de inundação com fatores urbanos estimados.
    """
    # Quanto menor o risco, mais viável
    safety_score = 1.0 - flood_risk

    # Pontos bem servidos por infraestrutura: altitude média (~510-530m em RP central)
    infra_score = 1.0 - abs(altitude - 520) / 100.0
    infra_score = max(0.0, min(1.0, infra_score))

    # Distância ideal da água: 0.5–3km (perto mas sem risco)
    if distance_to_water_km < 0.3:
        water_score = 0.3  # muito perto = arriscado
    elif distance_to_water_km < 3.0:
        water_score = 1.0
    else:
        water_score = max(0.3, 1.0 - (distance_to_water_km - 3.0) / 10.0)

    viability = safety_score * 0.50 + infra_score * 0.30 + water_score * 0.20
    viability = round(min(max(viability, 0.0), 1.0), 4)

    if viability > 0.70:
        recommendation = "Localização excelente para investimento comercial"
    elif viability > 0.50:
        recommendation = "Viável com atenção ao risco hídrico sazonal"
    elif viability > 0.30:
        recommendation = "Risco moderado — exige seguro e medidas de mitigação"
    else:
        recommendation = "Localização de alto risco — desaconselhada para retail"

    return {
        "viability_score": viability,
        "recommendation": recommendation,
        "components": {
            "safety_score": round(safety_score, 4),
            "infra_score": round(infra_score, 4),
            "water_proximity_score": round(water_score, 4),
        },
    }
