from fastapi import APIRouter, Query

from services.nasa_firms import get_firms_fires
from services.nasa_power import get_power_daily

router = APIRouter()

# Ribeirão Preto, SP — default point sits in the urban/cane-belt transition.
DEFAULT_LAT = -21.1775
DEFAULT_LON = -47.8099


@router.get("/power", summary="NASA POWER daily agroclimate + Farm Climate Risk")
async def nasa_power(
    lat: float = Query(default=DEFAULT_LAT, ge=-90, le=90),
    lon: float = Query(default=DEFAULT_LON, ge=-180, le=180),
    days: int = Query(default=30, ge=1, le=60),
):
    """
    Daily NASA POWER (community AG) series for a farmland point.

    Window ends five days before today. Parameters: PRECTOTCORR, T2M,
    T2M_MAX, RH2M, GWETROOT, GWETTOP, ALLSKY_SFC_SW_DWN. Fill value -999
    is dropped. Upstream failures return ok=false instead of raising.
    """
    return await get_power_daily(lat, lon, days)


@router.get("/firms", summary="NASA FIRMS active fires around Ribeirão Preto")
async def nasa_firms():
    """
    Active fire detections inside bbox (-48.5, -21.8, -47.2, -20.6).

    Uses the FIRMS area API when FIRMS_MAP_KEY is set. Otherwise reads the
    public Suomi NPP VIIRS, MODIS, and NOAA-20 VIIRS South America 7-day CSVs.
    Upstream failures return ok=false and fallback="simulated".
    """
    return await get_firms_fires()
