# AQUACITIES 3D 🌊

> **Flood Risk Intelligence para Ribeirão Preto, SP**  
> Dashboard cyberpunk de visualização de risco de inundação e geomarketing.

---

## Stack

| Camada | Tech |
|--------|------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Mapa 3D | Mapbox GL JS (dark-v11, extrusão de prédios, terrain-RGB) |
| Backend | Python 3.11+ + FastAPI |
| Dados | Open-Meteo API (precipitação) + Mapbox Terrain-RGB (elevação) + NASA POWER + NASA FIRMS |

---

## Modules

### 🗺 Flood Map 3D
- Mapa dark cyberpunk com extrusão 3D dos prédios
- Slider de **Nível de Inundação** (0–50m) que preenche o mapa com camada azul/vermelha
- Cálculo de risco via fórmula:

$$Risco = \frac{(Precipitação \times Coeficiente\_Impermeabilidade)}{Altitude}$$

- Click no mapa → busca dados reais de elevação e chuva via API

### 📍 GeoMarketing
- Heatmap de viabilidade comercial
- Score de localização para pontos de varejo
- Análise de risco hídrico vs. fluxo de pedestres

---

## Quick Start

### 1. Configurar tokens

```bash
# Frontend
cp frontend/.env.example frontend/.env
# Edite frontend/.env e adicione seu VITE_MAPBOX_TOKEN
# Token gratuito em: https://account.mapbox.com

# Backend
cp backend/.env.example backend/.env
# Adicione MAPBOX_TOKEN (mesmo token)
```

### 2. Backend (FastAPI)

```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/Mac:
# source venv/bin/activate

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Documentação interativa: http://localhost:8000/docs

### 3. Frontend (React)

```bash
cd frontend
npm install
npm run dev
```

Acesse: http://localhost:3000

---

## Estrutura do Projeto

```
aquacities-3d/
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root component + estado global
│   │   ├── components/
│   │   │   ├── Map3D.jsx           # Mapa Mapbox GL (extrusão + flood layer)
│   │   │   ├── Sidebar.jsx         # Painel de controle cyberpunk
│   │   │   ├── TopBar.jsx          # Header com módulos e clock
│   │   │   └── RiskCard.jsx        # Card de score de viabilidade
│   │   └── index.css               # Tailwind + estilos cyberpunk
│   ├── tailwind.config.js
│   └── vite.config.js
│
├── backend/
│   ├── main.py                     # FastAPI app
│   ├── routers/
│   │   ├── flood.py                # /api/flood/risk, /elevation, /precipitation
│   │   └── geomarketing.py         # /api/geo/viability, /hubs
│   ├── services/
│   │   ├── elevation.py            # Mapbox Terrain-RGB
│   │   ├── precipitation.py        # Open-Meteo API
│   │   └── risk_calculator.py      # Lógica de risco + Haversine
│   ├── models/
│   │   └── schemas.py              # Pydantic models
│   └── requirements.txt
│
└── README.md
```

---

## API Endpoints

```
GET /api/flood/risk?lat=-21.177&lon=-47.810&water_level=10
GET /api/flood/elevation?lat=-21.177&lon=-47.810
GET /api/flood/precipitation?lat=-21.177&lon=-47.810&days=7
GET /api/geo/viability?lat=-21.177&lon=-47.810
GET /api/geo/hubs
GET /api/nasa/power?lat=-21.1775&lon=-47.8099&days=30
GET /api/nasa/firms
```

---

## Notas

- **Sem token Mapbox**: o sistema usa estimativas topográficas locais (funciona para demo)
- **Open-Meteo**: API gratuita, sem chave, dados reais de precipitação
- O heatmap de risco usa 120 pontos simulados — substitua por dados do INMET/Ana para produção

---

## NASA data for Field Shift (English)

AQUACITIES 3D is entered in NASA Space Apps Challenge 2026, challenge **Field Shift: Adapting Farms With NASA Data**. The original dashboard tracked urban flood and fire risk in Ribeirão Preto, SP with Open-Meteo weather and 12 simulated fire points. This section adds real NASA observations for the surrounding sugarcane belt, so a farm decision can sit next to the city flood view.

Ribeirão Preto is in the center of São Paulo cane country. Two open NASA products cover the questions that matter there in a wet-season window: is the root zone drying out under heat, is heavy rain saturating the topsoil, and are active fires burning on nearby fields?

### Sources

| Product | What we use | Link |
|---------|-------------|------|
| NASA POWER, community `AG` | Daily corrected precipitation (`PRECTOTCORR`), 2 m temperature (`T2M`, `T2M_MAX`), humidity (`RH2M`), root-zone and surface soil wetness (`GWETROOT`, `GWETTOP`), and incoming shortwave (`ALLSKY_SFC_SW_DWN`) | [POWER API](https://power.larc.nasa.gov/docs/services/api/) · [POWER site](https://power.larc.nasa.gov/) |
| NASA FIRMS | Active fire detections (VIIRS S-NPP, VIIRS NOAA-20, MODIS) inside bbox west/south/east/north `-48.5, -21.8, -47.2, -20.6` | [FIRMS](https://firms.modaps.eosdis.nasa.gov/) · [area API](https://firms.modaps.eosdis.nasa.gov/api/area/) |

POWER calls need no key. The daily request ends **5 days before today** because the archive lags, and values of `-999` are dropped before any average or score.

FIRMS prefers the area API when `FIRMS_MAP_KEY` is set (free key from the [FIRMS area API page](https://firms.modaps.eosdis.nasa.gov/api/area/)). Without a key the backend reads public 7-day CSVs, in order:

- Suomi NPP VIIRS: `https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_South_America_7d.csv`
- MODIS: `https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_7d.csv`
- NOAA-20 VIIRS, used when the Suomi NPP file is empty (it is sometimes published as a header only): `https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_South_America_7d.csv`

Detections are filtered to the bbox above and collapsed to about 2 km on the same day. If every FIRMS feed fails, the map keeps the original CSS flame overlay on the 12 built-in points and labels that layer `simulated`.

### Farm Climate Risk

`GET /api/nasa/power` returns the daily series, a summary, and a single indicator:

- **Drought stress** rises when root-zone wetness is low, 30-day-equivalent rain is low, and mean daily maximum temperature is high. Weights: 0.45 soil (`GWETROOT` from 0.45 down to 0.20), 0.35 rain (80 mm down to 20 mm), 0.20 heat (`T2M_MAX` from 32 °C up to 38 °C).
- **Waterlogging** rises when rain is high and surface wetness is high. Weights: 0.60 rain (80 mm up to 200 mm), 0.40 surface (`GWETTOP` from 0.60 up to 0.90).
- The level is the larger of the two scores: `LOW` &lt; 0.25, `MODERATE` &lt; 0.50, `HIGH` &lt; 0.75, otherwise `SEVERE`.

Rain thresholds use a 30-day equivalent (mean daily `PRECTOTCORR` × 30) so a missing day is not counted as zero rain. The same rules are returned in the JSON field `farm_climate_risk.method`.

### Usage

```bash
# 30-day POWER series and Farm Climate Risk for Ribeirão Preto
curl "http://localhost:8000/api/nasa/power?lat=-21.1775&lon=-47.8099&days=30"

# FIRMS detections in the cane-belt bbox
curl "http://localhost:8000/api/nasa/firms"
```

Optional area-API key (backend `.env`):

```bash
FIRMS_MAP_KEY=your_map_key
```

The React sidebar shows a **NASA Farm Panel** (English labels) with 30-day rain, temperature, root-zone soil moisture, Farm Climate Risk, the FIRMS fire count, and the line `Source: NASA POWER / NASA FIRMS`. The Wildfire module draws the CSS flames on real FIRMS points when `ok` is true.

Timeouts are bounded (about 12 s for POWER, 25 s for FIRMS). A failed upstream call returns `ok: false` and the UI stays up: POWER fields render as unavailable, and fires fall back to the simulated points.

### Development note

The team used AI assistants to support development of this NASA integration.
