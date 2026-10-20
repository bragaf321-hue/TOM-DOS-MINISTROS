#!/bin/bash
cd "$(dirname "$0")"
echo "==================================================="
echo "  Iniciando Tom do Louvor (Servidor + Link Público)"
echo "==================================================="
pkill -f "node server.js" 2>/dev/null || true
node server.js &
SERVER_PID=$!
sleep 2
echo ""
echo "Gerando link público gratuito via Cloudflare..."
cloudflared tunnel --protocol http2 --edge-ip-version 4 --url http://127.0.0.1:3080
kill $SERVER_PID 2>/dev/null || true
