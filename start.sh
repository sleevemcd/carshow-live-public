#!/bin/sh
cd /app && npm start &
sleep 8
# Free permanent tunnel via serveo
echo "Starting tunnel..."
ssh -o StrictHostKeyChecking=no -R carshow:80:localhost:3000 serveo.net 2>&1 &
