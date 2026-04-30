@echo off
echo ============================================
echo  nalam.ai — Demo Runner (Windows)
echo ============================================
echo.

echo [1/2] Starting Python ML service (LangGraph + ChromaDB)...
start "nalam-ml" cmd /c "cd /d C:\Users\dhanu\Downloads\HH26\sentinel\src\ml-service && start.bat"

echo Waiting 8s for ML service to initialise...
timeout /t 8 /nobreak >nul

echo [2/2] Starting Next.js dev server...
start "nalam-app" cmd /c "cd /d C:\Users\dhanu\Downloads\HH26\sentinel && npm run dev"

echo.
echo ============================================
echo  nalam.ai is starting!
echo  Frontend:    http://localhost:3000
echo  ML API:      http://localhost:8005
echo  ML API docs: http://localhost:8005/docs
echo ============================================
pause
