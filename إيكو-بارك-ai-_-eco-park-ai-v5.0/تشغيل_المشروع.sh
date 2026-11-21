#!/usr/bin/env bash
set -e

echo "Starting Eco-Park AI v5.0 (React + Express Server on Port 3000)..."
if [ ! -d "node_modules" ]; then
  npm install
fi
npm run dev
