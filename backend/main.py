from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import flood, geomarketing, databricks

app = FastAPI(
    title="AQUACITIES 3D API",
    description="Backend de análise de risco de inundação para Ribeirão Preto, SP",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(flood.router, prefix="/api/flood", tags=["Flood Risk"])
app.include_router(geomarketing.router, prefix="/api/geo", tags=["GeoMarketing"])
app.include_router(databricks.router, prefix="/api/db", tags=["Databricks"])


@app.get("/")
def root():
    return {
        "project": "AQUACITIES 3D",
        "status": "online",
        "docs": "/docs",
    }


@app.get("/health")
async def health():
    from services.databricks_service import is_configured
    return {
        "status": "ok",
        "databricks": "connected" if is_configured() else "not_configured",
    }
