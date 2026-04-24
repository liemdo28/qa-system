#!/usr/bin/env bash
# QA Control Center — One-Click Launcher (Mac/Linux)
# Usage: bash start-qa-system.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "  ${GREEN}[OK]${NC}   $1"; }
step() { echo -e "  ${YELLOW}[....]${NC} $1"; }
fail() { echo -e "  ${RED}[FAIL]${NC} $1"; }
warn() { echo -e "  ${YELLOW}[WARN]${NC} $1"; }

echo ""
echo -e "  ${CYAN}=========================================${NC}"
echo -e "  ${CYAN} QA CONTROL CENTER  |  ONE-CLICK LAUNCHER${NC}"
echo -e "  ${CYAN}=========================================${NC}"
echo ""

# ── Check Node.js ──────────────────────────────────
if ! command -v node &>/dev/null; then
    fail "Node.js not found. Install: https://nodejs.org/"
    exit 1
fi
ok "Node.js $(node --version)"

# ── Check Git ──────────────────────────────────────
if ! command -v git &>/dev/null; then
    fail "Git not found. Install: https://git-scm.com/"
    exit 1
fi
ok "Git $(git --version | awk '{print $3}')"

# ── Pull latest ────────────────────────────────────
step "Pulling latest QA system..."
git pull 2>/dev/null || warn "git pull failed — using local copy"
ok "QA system up to date"

# ── Install root deps ──────────────────────────────
if [ ! -d "node_modules" ]; then
    step "Installing root dependencies (first run)..."
    npm install --silent
    ok "Root dependencies installed"
else
    ok "Root dependencies present"
fi

# ── Install frontend deps ──────────────────────────
if [ ! -d "frontend/node_modules" ]; then
    step "Installing frontend dependencies (first run)..."
    (cd frontend && npm install --silent)
    ok "Frontend dependencies installed"
else
    ok "Frontend dependencies present"
fi

# ── Logs directory ─────────────────────────────────
mkdir -p logs
ok "Logs directory ready"

# ── Free port 3001 ─────────────────────────────────
if lsof -ti:3001 &>/dev/null; then
    step "Port 3001 in use — clearing..."
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    sleep 1
fi

# ── Start backend ──────────────────────────────────
step "Starting QA backend on port 3001..."
npm run start:backend > logs/backend.log 2>&1 &
BACKEND_PID=$!
ok "Backend started (PID $BACKEND_PID)"

# ── Wait for backend ───────────────────────────────
step "Waiting for backend to be ready..."
for i in $(seq 1 25); do
    sleep 2
    if curl -sf http://localhost:3001/api/health &>/dev/null; then
        ok "Backend is ready"
        break
    fi
    if [ "$i" -eq 25 ]; then
        warn "Backend slow — check logs/backend.log"
    fi
done

# ── Start frontend ─────────────────────────────────
step "Starting QA frontend on port 5173..."
npm run start:frontend > logs/frontend.log 2>&1 &
FRONTEND_PID=$!
ok "Frontend started (PID $FRONTEND_PID)"

sleep 10

# ── Open browser ───────────────────────────────────
step "Opening QA Control Center..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open http://localhost:5173
elif command -v xdg-open &>/dev/null; then
    xdg-open http://localhost:5173
else
    warn "Open manually: http://localhost:5173"
fi

# ── Done ───────────────────────────────────────────
echo ""
echo -e "  ${CYAN}=========================================${NC}"
echo -e "  ${GREEN} QA CONTROL CENTER IS RUNNING${NC}"
echo -e "  ${CYAN}=========================================${NC}"
echo -e "   Dashboard : http://localhost:5173"
echo -e "   API       : http://localhost:3001/api"
echo -e "   Logs      : $ROOT/logs/"
echo ""
echo -e "   Press ${RED}Ctrl+C${NC} to stop all services"
echo -e "  ${CYAN}=========================================${NC}"
echo ""

# Keep running and clean up on Ctrl+C
trap "echo ''; echo 'Stopping...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM
wait
