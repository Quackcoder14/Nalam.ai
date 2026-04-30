#!/usr/bin/env bash
set -e

echo "============================================"
echo " nalam.ai — Demo Runner (Linux/Mac)"
echo "============================================"

# Start ML service in background
echo "Starting Python ML service..."
cd src/ml-service
pip install -r requirements.txt -q
uvicorn main:app --port 8001 &
ML_PID=$!
cd ..

echo "Waiting for ML service..."
sleep 4

# Start Next.js
echo "Starting Next.js dev server..."
npm run dev &
APP_PID=$!

echo ""
echo "============================================"
echo " nalam.ai running!"
echo " Frontend: http://localhost:3000"
echo " ML API:   http://localhost:8001/docs"
echo " Press Ctrl+C to stop all services"
echo "============================================"

# Wait for Ctrl+C
trap "kill $ML_PID $APP_PID 2>/dev/null; exit" INT
wait
