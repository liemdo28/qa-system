@echo off
setlocal EnableDelayedExpansion
title QA Control Center — Launcher
color 0B

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo  =========================================
echo   QA CONTROL CENTER  ^|  ONE-CLICK LAUNCHER
echo  =========================================
echo.

:: ─── Check Node.js ──────────────────────────────
node --version >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Node.js is not installed.
    echo         Download: https://nodejs.org/
    echo.
    pause & exit /b 1
)
for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v
echo  [OK]  Node.js %NODE_VER%

:: ─── Check Git ──────────────────────────────────
git --version >nul 2>&1
if errorlevel 1 (
    echo  [FAIL] Git is not installed.
    echo         Download: https://git-scm.com/
    echo.
    pause & exit /b 1
)
echo  [OK]  Git found

:: ─── Pull latest QA system ──────────────────────
echo  [....] Pulling latest QA system...
git pull 2>nul
echo  [OK]  QA system up to date

:: ─── Install root dependencies ──────────────────
if not exist "node_modules" (
    echo  [....] Installing root dependencies ^(first run^)...
    npm install --silent
    if errorlevel 1 ( echo  [FAIL] npm install failed && pause && exit /b 1 )
    echo  [OK]  Root dependencies installed
) else (
    echo  [OK]  Root dependencies present
)

:: ─── Install frontend dependencies ──────────────
if not exist "frontend\node_modules" (
    echo  [....] Installing frontend dependencies ^(first run^)...
    cd frontend
    npm install --silent
    if errorlevel 1 ( echo  [FAIL] Frontend npm install failed && cd .. && pause && exit /b 1 )
    cd ..
    echo  [OK]  Frontend dependencies installed
) else (
    echo  [OK]  Frontend dependencies present
)

:: ─── Create logs directory ──────────────────────
if not exist "logs" mkdir logs
echo  [OK]  Logs directory ready

:: ─── Free port 3001 if occupied ─────────────────
for /f "tokens=5" %%p in ('netstat -ano 2^>nul ^| findstr ":3001 " ^| findstr "LISTENING"') do (
    echo  [....] Port 3001 in use by PID %%p — clearing...
    taskkill /PID %%p /F >nul 2>&1
)

:: ─── Start QA Backend ───────────────────────────
echo  [....] Starting QA backend on port 3001...
start "QA Backend [3001]" cmd /k "cd /d "%ROOT%" && npm run start:backend 2>&1 | tee logs\backend.log"
echo  [OK]  Backend window opened

:: ─── Wait for backend to be ready ───────────────
echo  [....] Waiting for backend...
set /a TRIES=0
:check_backend
timeout /t 2 /nobreak >nul
set /a TRIES+=1
powershell -NonInteractive -Command "try { Invoke-WebRequest 'http://localhost:3001/api/health' -UseBasicParsing -TimeoutSec 1 | Out-Null; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
    if !TRIES! lss 20 goto check_backend
    echo  [WARN] Backend taking longer than expected — check the backend window
) else (
    echo  [OK]  Backend is ready ^(took ~!TRIES! checks^)
)

:: ─── Start QA Frontend ──────────────────────────
echo  [....] Starting QA frontend on port 5173...
start "QA Frontend [5173]" cmd /k "cd /d "%ROOT%" && npm run start:frontend 2>&1 | tee logs\frontend.log"
echo  [OK]  Frontend window opened

:: ─── Wait for frontend ──────────────────────────
echo  [....] Waiting for frontend to load...
timeout /t 10 /nobreak >nul

:: ─── Open Browser ───────────────────────────────
echo  [....] Opening QA Control Center in browser...
start http://localhost:5173

:: ─── Done ───────────────────────────────────────
echo.
echo  =========================================
echo   QA CONTROL CENTER IS RUNNING
echo  =========================================
echo.
echo   Dashboard :  http://localhost:5173
echo   API       :  http://localhost:3001/api
echo   Logs      :  %ROOT%logs\
echo.
echo   Two service windows are running:
echo     "QA Backend [3001]"
echo     "QA Frontend [5173]"
echo.
echo   Close those windows to stop the system.
echo  =========================================
echo.
pause
endlocal
