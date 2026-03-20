@echo off
echo.
echo  NeuroFlux Mold Enterprise — Setup Inicial
echo  ==========================================
echo.

echo [1/4] Instalando dependencias do Backend...
cd /d "%~dp0backend"
call npm install

echo.
echo [2/4] Criando banco de dados e tabelas...
call npx prisma db push

echo.
echo [3/4] Populando dados iniciais...
call npm run db:seed

echo.
echo [4/4] Instalando dependencias do Frontend...
cd /d "%~dp0frontend"
call npm install

echo.
echo  ==========================================
echo  Setup concluido!
echo.
echo  Para iniciar o sistema, execute: start.bat
echo.
echo  Credenciais de acesso:
echo    Admin:     rafael@euromoldes.com.br / euromoldes2024
echo    Engenheiro: engenheiro@euromoldes.com.br / engenheiro123
echo.
pause
