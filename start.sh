#!/bin/sh
cd /app && npm start &
sleep 8
# Download and run cloudflare tunnel
wget -qO /tmp/cf https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x /tmp/cf
echo "Starting tunnel..."
/tmp/cf tunnel --url http://localhost:3000 2>&1
