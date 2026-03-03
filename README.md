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
| Dados | Open-Meteo API (precipitação) + Mapbox Terrain-RGB (elevação) |

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
```

---

## Notas

- **Sem token Mapbox**: o sistema usa estimativas topográficas locais (funciona para demo)
- **Open-Meteo**: API gratuita, sem chave, dados reais de precipitação
- O heatmap de risco usa 120 pontos simulados — substitua por dados do INMET/Ana para produção
