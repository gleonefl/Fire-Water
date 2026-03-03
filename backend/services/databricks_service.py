"""
Serviço de integração com Databricks (Community Edition / Free).

Suporta:
  1. Databricks SQL Connector (databricks-sql-connector)
  2. REST API via HTTP (fallback para Community Edition sem SQL Warehouse)

Configuração via variáveis de ambiente:
  DATABRICKS_HOST          = ex: community.cloud.databricks.com
  DATABRICKS_TOKEN         = personal access token
  DATABRICKS_HTTP_PATH     = SQL warehouse HTTP path (se disponível)
  DATABRICKS_CATALOG       = catalog (default: hive_metastore)
  DATABRICKS_SCHEMA        = schema (default: aquacities)

Na Community Edition gratuita, usa-se a REST API + clusters interativos.
"""

import os
import logging
from typing import Optional

import httpx
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger("aquacities.databricks")

# ── Configuração ─────────────────────────────────────────────────────────────
DATABRICKS_HOST = os.getenv("DATABRICKS_HOST", "")
DATABRICKS_TOKEN = os.getenv("DATABRICKS_TOKEN", "")
DATABRICKS_HTTP_PATH = os.getenv("DATABRICKS_HTTP_PATH", "")
DATABRICKS_CATALOG = os.getenv("DATABRICKS_CATALOG", "hive_metastore")
DATABRICKS_SCHEMA = os.getenv("DATABRICKS_SCHEMA", "aquacities")


def is_configured() -> bool:
    """Checa se Databricks está configurado."""
    return bool(DATABRICKS_HOST and DATABRICKS_TOKEN)


# ── Conexão via databricks-sql-connector (melhor opção) ──────────────────────
_connection = None


def _get_sql_connection():
    """Cria/reutiliza conexão SQL nativa."""
    global _connection
    if _connection:
        return _connection
    try:
        from databricks import sql as databricks_sql

        _connection = databricks_sql.connect(
            server_hostname=DATABRICKS_HOST,
            http_path=DATABRICKS_HTTP_PATH,
            access_token=DATABRICKS_TOKEN,
            catalog=DATABRICKS_CATALOG,
            schema=DATABRICKS_SCHEMA,
        )
        logger.info("Conectado ao Databricks via SQL Connector")
        return _connection
    except ImportError:
        logger.warning("databricks-sql-connector não instalado — usando REST API")
        return None
    except Exception as e:
        logger.error(f"Erro SQL Connector: {e}")
        return None


async def execute_sql(query: str, params: Optional[dict] = None) -> list[dict]:
    """
    Executa SQL no Databricks. Tenta SQL Connector primeiro,
    fallback para REST API (Community Edition).
    """
    if not is_configured():
        logger.warning("Databricks não configurado — retornando dados simulados")
        return []

    # Tenta SQL nativo
    conn = _get_sql_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute(query, params)
            columns = [desc[0] for desc in cursor.description]
            rows = cursor.fetchall()
            cursor.close()
            return [dict(zip(columns, row)) for row in rows]
        except Exception as e:
            logger.error(f"SQL Connector falhou: {e}")
            _connection = None

    # Fallback: REST API (funciona com Community Edition)
    return await _execute_rest_api(query)


async def _execute_rest_api(query: str) -> list[dict]:
    """Executa SQL via Databricks REST API (Commands API)."""
    base = f"https://{DATABRICKS_HOST}"
    headers = {
        "Authorization": f"Bearer {DATABRICKS_TOKEN}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=60) as client:
        # 1. Lista clusters ativos
        clusters_res = await client.get(f"{base}/api/2.0/clusters/list", headers=headers)
        clusters_res.raise_for_status()
        clusters = clusters_res.json().get("clusters", [])

        # Encontra um cluster ativo ou em PENDING
        active = next(
            (c for c in clusters if c.get("state") in ("RUNNING", "PENDING", "RESIZING")),
            None,
        )

        if not active:
            logger.warning("Nenhum cluster ativo no Databricks")
            return []

        cluster_id = active["cluster_id"]

        # Se PENDING, espera ficar ativo
        if active["state"] != "RUNNING":
            logger.info(f"Cluster {cluster_id} está {active['state']}, aguardando...")
            import asyncio

            for _ in range(60):
                await asyncio.sleep(5)
                check = await client.get(
                    f"{base}/api/2.0/clusters/get",
                    headers=headers,
                    params={"cluster_id": cluster_id},
                )
                if check.json().get("state") == "RUNNING":
                    break

        # 2. Cria contexto de execução
        ctx_res = await client.post(
            f"{base}/api/1.2/contexts/create",
            headers=headers,
            json={"clusterId": cluster_id, "language": "sql"},
        )
        ctx_res.raise_for_status()
        context_id = ctx_res.json()["id"]

        # 3. Executa o comando
        cmd_res = await client.post(
            f"{base}/api/1.2/commands/execute",
            headers=headers,
            json={
                "clusterId": cluster_id,
                "contextId": context_id,
                "language": "sql",
                "command": query,
            },
        )
        cmd_res.raise_for_status()
        command_id = cmd_res.json()["id"]

        # 4. Espera resultado (polling)
        import asyncio

        for _ in range(120):
            status_res = await client.get(
                f"{base}/api/1.2/commands/status",
                headers=headers,
                params={
                    "clusterId": cluster_id,
                    "contextId": context_id,
                    "commandId": command_id,
                },
            )
            status_data = status_res.json()
            if status_data.get("status") == "Finished":
                results = status_data.get("results", {})
                if results.get("resultType") == "table":
                    schema = results.get("schema", [])
                    data = results.get("data", [])
                    columns = [col["name"] for col in schema]
                    return [dict(zip(columns, row)) for row in data]
                return []
            if status_data.get("status") in ("Cancelled", "Error"):
                logger.error(f"Comando falhou: {status_data}")
                return []
            await asyncio.sleep(2)

        logger.error("Timeout esperando resultado do Databricks")
        return []


# ── Funções específicas para AquaCities ──────────────────────────────────────

async def get_flood_history(lat: float, lon: float, radius_km: float = 1.0) -> list[dict]:
    """Busca histórico de inundações na região (se tabela existir)."""
    query = f"""
    SELECT event_date, water_level_m, precipitation_mm, affected_area_km2, severity
    FROM {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.flood_events
    WHERE ST_Distance(
        ST_Point(longitude, latitude),
        ST_Point({lon}, {lat})
    ) <= {radius_km * 1000}
    ORDER BY event_date DESC
    LIMIT 50
    """
    try:
        return await execute_sql(query)
    except Exception as e:
        logger.warning(f"Tabela flood_events não existe ou erro: {e}")
        return []


async def get_fire_history(lat: float, lon: float, radius_km: float = 2.0) -> list[dict]:
    """Busca histórico de incêndios na região."""
    query = f"""
    SELECT event_date, fire_type, area_burned_ha, response_time_min, severity
    FROM {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.fire_events
    WHERE ST_Distance(
        ST_Point(longitude, latitude),
        ST_Point({lon}, {lat})
    ) <= {radius_km * 1000}
    ORDER BY event_date DESC
    LIMIT 50
    """
    try:
        return await execute_sql(query)
    except Exception as e:
        logger.warning(f"Tabela fire_events não existe ou erro: {e}")
        return []


async def save_risk_assessment(data: dict) -> bool:
    """Salva avaliação de risco no Databricks para analytics."""
    query = f"""
    INSERT INTO {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.risk_assessments
    (lat, lon, flood_risk, fire_risk, commercial_score, water_level, timestamp)
    VALUES (
        {data.get('lat', 0)},
        {data.get('lon', 0)},
        {data.get('flood_risk', 0)},
        {data.get('fire_risk', 0)},
        {data.get('commercial_score', 0)},
        {data.get('water_level', 0)},
        current_timestamp()
    )
    """
    try:
        await execute_sql(query)
        return True
    except Exception as e:
        logger.warning(f"Não foi possível salvar assessment: {e}")
        return False


async def get_analytics_summary() -> dict:
    """Retorna resumo analítico dos dados armazenados."""
    query = f"""
    SELECT
        COUNT(*) as total_assessments,
        AVG(flood_risk) as avg_flood_risk,
        AVG(fire_risk) as avg_fire_risk,
        AVG(commercial_score) as avg_commercial_score,
        MAX(flood_risk) as max_flood_risk,
        MIN(flood_risk) as min_flood_risk
    FROM {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.risk_assessments
    WHERE timestamp >= date_sub(current_date(), 30)
    """
    try:
        rows = await execute_sql(query)
        return rows[0] if rows else {}
    except Exception:
        return {}


# ── DDL: cria tabelas se não existirem ───────────────────────────────────────

SETUP_DDL = f"""
-- Execute isso no Databricks para criar o schema e tabelas

CREATE SCHEMA IF NOT EXISTS {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA};

CREATE TABLE IF NOT EXISTS {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.flood_events (
    event_date DATE,
    latitude DOUBLE,
    longitude DOUBLE,
    water_level_m DOUBLE,
    precipitation_mm DOUBLE,
    affected_area_km2 DOUBLE,
    severity STRING
);

CREATE TABLE IF NOT EXISTS {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.fire_events (
    event_date DATE,
    latitude DOUBLE,
    longitude DOUBLE,
    fire_type STRING,
    area_burned_ha DOUBLE,
    response_time_min INT,
    severity STRING
);

CREATE TABLE IF NOT EXISTS {DATABRICKS_CATALOG}.{DATABRICKS_SCHEMA}.risk_assessments (
    lat DOUBLE,
    lon DOUBLE,
    flood_risk DOUBLE,
    fire_risk DOUBLE,
    commercial_score DOUBLE,
    water_level DOUBLE,
    timestamp TIMESTAMP
);
"""
