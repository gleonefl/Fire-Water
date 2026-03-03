@echo off
echo.
echo  ╔══════════════════════════════════════╗
echo  ║    AQUACITIES 3D — Starting up...    ║
echo  ╚══════════════════════════════════════╝
echo.

:: --- Backend ---
echo [1/2] Iniciando backend FastAPI na porta 8000...
cd backend
if not exist venv (
    echo    Criando venv Python...
    python -m venv venv
    call venv\Scripts\activate
    pip install -r requirements.txt
) else (
    call venv\Scripts\activate
)

if not exist .env (
    copy .env.example .env
    echo    AVISO: backend\.env criado — adicione seu MAPBOX_TOKEN
)

start "AQUACITIES Backend" cmd /k "venv\Scripts\activate && uvicorn main:app --reload --port 8000"
cd ..

:: --- Frontend ---
echo [2/2] Iniciando frontend React na porta 3000...
cd frontend

if not exist node_modules (
    echo    Instalando dependencias npm...
    npm install
)

if not exist .env (
    copy .env.example .env
    echo    AVISO: frontend\.env criado — adicione seu VITE_MAPBOX_TOKEN
)

start "AQUACITIES Frontend" cmd /k "npm run dev"
cd ..

echo.
echo  ✔ Backend:  http://localhost:8000/docs
echo  ✔ Frontend: http://localhost:3000
echo.
