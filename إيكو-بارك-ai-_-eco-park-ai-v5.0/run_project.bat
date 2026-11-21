@echo off
echo Starting Eco-Park AI v5.0 (React + Express Server on Port 3000)...
if not exist node_modules (
  call npm install
)
call npm run dev
