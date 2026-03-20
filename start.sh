#!/bin/bash

echo "🏢 Iniciando Escritório Virtual Multiplayer..."
echo ""

# Verificar se node_modules existe
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências do frontend..."
    npm install
fi

if [ ! -d "server/node_modules" ]; then
    echo "📦 Instalando dependências do servidor..."
    cd server && npm install && cd ..
fi

echo ""
echo "✅ Dependências instaladas!"
echo ""
echo "🚀 Iniciando servidor WebSocket..."
cd server && PORT=3001 npm run dev &
SERVER_PID=$!

# Esperar o servidor iniciar
sleep 3

echo "🚀 Iniciando frontend Next.js..."
cd "$(dirname "$0")"
npm run dev &
FRONTEND_PID=$!

echo ""
echo "✨ Aplicação rodando!"
echo "📡 Servidor: http://localhost:3001"
echo "🌐 Frontend: http://localhost:3000"
echo ""
echo "Pressione Ctrl+C para parar"

# Aguardar interrupção
trap "kill $SERVER_PID $FRONTEND_PID" EXIT

wait
