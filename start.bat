@echo off
setlocal

cd /d E:\Project\Master\qa-system

echo ========================================
echo  QA Control Center — Starting Up
echo ========================================

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed or not in PATH.
  echo Download from https://nodejs.org
  pause
  exit /b 1
)

:: Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
  echo ERROR: npm is not installed or not in PATH.
  pause
  exit /b 1
)

:: Optional git pull
where git >nul 2>nul
if %errorlevel% equ 0 (
  echo Pulling latest qa-system source...
  git pull
) else (
  echo WARNING: Git not found. Skipping git pull.
)

:: Kill stale processes on port 3001 and 5173
echo Clearing ports 3001 and 5173...
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
  taskkill /PID %%p /F >nul 2>nul
)

:: Install QA system deps if missing
if not exist node_modules (
  echo Installing qa-system dependencies...
  npm install
)

if not exist frontend\node_modules (
  echo Installing frontend dependencies...
  cd frontend && npm install && cd ..
)

:: Start backend in new window
echo Starting QA backend...
start "QA Backend" cmd /k "cd /d E:\Project\Master\qa-system && npm run start:backend"

:: Wait for backend to be ready
echo Waiting for backend...
:wait_backend
timeout /t 2 >nul
powershell -Command "try { $r = Invoke-WebRequest -Uri http://localhost:3001/api/health -UseBasicParsing -TimeoutSec 2; exit 0 } catch { exit 1 }" >nul 2>nul
if %errorlevel% neq 0 goto wait_backend
echo Backend is ready.

:: Start frontend in new window
echo Starting QA frontend...
start "QA Frontend" cmd /k "cd /d E:\Project\Master\qa-system && npm run start:frontend"

:: Wait then open browser
echo Waiting for frontend...
timeout /t 6 >nul

echo Opening QA Dashboard...
start http://localhost:5173

echo.
echo ========================================
echo  QA Control Center is running!
echo  Dashboard: http://localhost:5173
echo  API:       http://localhost:3001/api
echo ========================================
echo.
echo You can close this window. The dashboard is open in your browser.
pause
