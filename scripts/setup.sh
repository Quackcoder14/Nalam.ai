#!/usr/bin/env bash
set -e

echo "============================================"
echo " nalam.ai — Project Setup (Linux/Mac)"
echo "============================================"

echo "[1/4] Installing Node.js dependencies..."
npm install

echo "[2/4] Generating Prisma client..."
npx prisma generate

echo "[3/4] Running database migrations..."
npx prisma migrate dev --name init_encrypted_schema

echo "[4/4] Seeding encrypted patient data..."
npx tsx scripts/seed.ts

echo ""
echo "============================================"
echo " Setup complete! Run: npm run dev"
echo " App will be at: http://localhost:3000"
echo "============================================"
