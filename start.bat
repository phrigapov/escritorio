@echo off
echo 🏢 Iniciando Escritório Virtual Multiplayer...
echo.

REM Verificar e instalar dependências
if not exist "node_modules" (
    echo 📦 Instalando dependências do frontend...
    call npm install
)

if not exist "server\node_modules" (
    echo 📦 Instalando dependências do servidor...
    cd server
    call npm install
    cd ..
)

echo.
echo ✅ Dependências instaladas!
echo.

REM Iniciar servidor em uma nova janela
echo 🚀 Iniciando servidor WebSocket...
start "Servidor WebSocket" cmd /k "cd server && npm run dev"

REM Aguardar um pouco
timeout /t 3 /nobreak > nul

REM Iniciar frontend
echo 🚀 Iniciando frontend Next.js...
start "Frontend Next.js" cmd /k "npm run dev"

echo.
echo ✨ Aplicação rodando!
echo 📡 Servidor: http://localhost:3001
echo 🌐 Frontend: http://localhost:3000
echo.
echo Para parar, feche as janelas do servidor e frontend
pause
