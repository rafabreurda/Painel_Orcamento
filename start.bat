@echo off
echo.
echo  NeuroFlux Mold Enterprise — Iniciando...
echo.

cd /d "%~dp0backend"
start cmd /k "npm run dev"

cd /d "%~dp0frontend"
start cmd /k "npm run dev"

echo.
echo  Backend: http://localhost:3001
echo  Frontend: http://localhost:5173
echo.
pause
