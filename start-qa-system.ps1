#Requires -Version 5.1
<#
.SYNOPSIS
    QA Control Center — One-Click Launcher (PowerShell)
.DESCRIPTION
    Checks prerequisites, installs dependencies, starts backend + frontend,
    and opens the QA dashboard in the default browser.
.EXAMPLE
    Right-click > Run with PowerShell
    # OR in terminal:
    powershell -ExecutionPolicy Bypass -File start-qa-system.ps1
#>

$ErrorActionPreference = 'Stop'
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $ROOT

function Write-Step  { param($msg) Write-Host "  [....] $msg" -ForegroundColor Yellow }
function Write-OK    { param($msg) Write-Host "  [OK]  $msg"  -ForegroundColor Green  }
function Write-Fail  { param($msg) Write-Host "  [FAIL] $msg" -ForegroundColor Red    }
function Write-Warn  { param($msg) Write-Host "  [WARN] $msg" -ForegroundColor DarkYellow }

Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "   QA CONTROL CENTER  |  ONE-CLICK LAUNCHER" -ForegroundColor Cyan
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""

# ── Check Node.js ─────────────────────────────────
try {
    $nodeVer = & node --version 2>&1
    Write-OK "Node.js $nodeVer"
} catch {
    Write-Fail "Node.js not found. Download: https://nodejs.org/"
    Read-Host "Press Enter to exit"; exit 1
}

# ── Check Git ─────────────────────────────────────
try {
    & git --version 2>&1 | Out-Null
    Write-OK "Git found"
} catch {
    Write-Fail "Git not found. Download: https://git-scm.com/"
    Read-Host "Press Enter to exit"; exit 1
}

# ── Pull latest ───────────────────────────────────
Write-Step "Pulling latest QA system..."
try { & git pull 2>&1 | Out-Null } catch { Write-Warn "git pull failed — continuing with local copy" }
Write-OK "QA system up to date"

# ── Install root deps ─────────────────────────────
if (-not (Test-Path "node_modules")) {
    Write-Step "Installing root dependencies (first run)..."
    & npm install --silent
    if ($LASTEXITCODE -ne 0) { Write-Fail "npm install failed"; Read-Host "Press Enter"; exit 1 }
    Write-OK "Root dependencies installed"
} else {
    Write-OK "Root dependencies present"
}

# ── Install frontend deps ─────────────────────────
if (-not (Test-Path "frontend\node_modules")) {
    Write-Step "Installing frontend dependencies (first run)..."
    Push-Location frontend
    & npm install --silent
    Pop-Location
    if ($LASTEXITCODE -ne 0) { Write-Fail "Frontend npm install failed"; Read-Host "Press Enter"; exit 1 }
    Write-OK "Frontend dependencies installed"
} else {
    Write-OK "Frontend dependencies present"
}

# ── Logs directory ────────────────────────────────
New-Item -ItemType Directory -Force -Path "logs" | Out-Null
Write-OK "Logs directory ready"

# ── Free port 3001 ────────────────────────────────
try {
    $conn = Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Write-Step "Port 3001 in use (PID $($conn.OwningProcess)) — clearing..."
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
    }
} catch { }

# ── Start backend ─────────────────────────────────
Write-Step "Starting QA backend on port 3001..."
$backendArgs = "/k cd /d `"$ROOT`" && npm run start:backend"
Start-Process "cmd.exe" -ArgumentList $backendArgs -WindowStyle Normal
Write-OK "Backend window opened"

# ── Wait for backend ──────────────────────────────
Write-Step "Waiting for backend to be ready..."
$ready = $false
for ($i = 1; $i -le 25; $i++) {
    Start-Sleep -Seconds 2
    try {
        Invoke-WebRequest "http://localhost:3001/api/health" -UseBasicParsing -TimeoutSec 2 | Out-Null
        $ready = $true
        break
    } catch { }
}
if ($ready) { Write-OK "Backend is ready" }
else { Write-Warn "Backend slow to start — check the backend window" }

# ── Start frontend ────────────────────────────────
Write-Step "Starting QA frontend on port 5173..."
$frontendArgs = "/k cd /d `"$ROOT`" && npm run start:frontend"
Start-Process "cmd.exe" -ArgumentList $frontendArgs -WindowStyle Normal
Write-OK "Frontend window opened"

# ── Wait for frontend ─────────────────────────────
Write-Step "Waiting for frontend to load..."
Start-Sleep -Seconds 10

# ── Open browser ──────────────────────────────────
Write-Step "Opening QA Control Center..."
Start-Process "http://localhost:5173"

# ── Done ──────────────────────────────────────────
Write-Host ""
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "   QA CONTROL CENTER IS RUNNING" -ForegroundColor Green
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host "   Dashboard : http://localhost:5173"       -ForegroundColor White
Write-Host "   API       : http://localhost:3001/api"   -ForegroundColor White
Write-Host "   Logs      : $ROOT\logs\"                 -ForegroundColor White
Write-Host ""
Write-Host "   Close the Backend and Frontend windows"  -ForegroundColor Gray
Write-Host "   to stop all services."                   -ForegroundColor Gray
Write-Host "  =========================================" -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close this launcher"
