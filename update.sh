#!/bin/bash
# IT Change Logger — Application Update Script
# Pulls latest code, installs deps, rebuilds frontend, reloads PM2 (zero-downtime)
# Safe to run at any time.
#
# Usage:
#   ./update.sh                — standard update (git pull required)
#   ./update.sh --force        — skip git‑clean check and skip "nothing changed" bail‑out
#   ./update.sh --no-restart   — update files only; do NOT reload PM2
#   ./update.sh --skip-build   — skip frontend webpack build (backend changes only)

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
log()  { echo -e "${CYAN}[update]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✔ $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
fail() { echo -e "${RED}  ✖ $*${RESET}"; exit 1; }

# ── Args ──────────────────────────────────────────────────────────────────────
FORCE=false
NO_RESTART=false
SKIP_BUILD=false
for arg in "$@"; do
  case "$arg" in
    --force)       FORCE=true ;;
    --no-restart)  NO_RESTART=true ;;
    --skip-build)  SKIP_BUILD=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  IT Change Logger — Update${RESET}"
echo -e "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1 — Git pull
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[1/5] Git pull"

if ! git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
  fail "Not a git repository. Update files manually and re-run setup.sh."
fi

# Warn about local changes
if [ "$FORCE" = false ]; then
  if ! git -C "$SCRIPT_DIR" diff --quiet || ! git -C "$SCRIPT_DIR" diff --cached --quiet; then
    warn "You have uncommitted local changes that may be overwritten."
    read -r -p "  Continue anyway? [y/N] " response
    case "$response" in [yY][eE][sS]|[yY]) ;; *) echo "Update cancelled."; exit 0 ;; esac
  fi
fi

BEFORE_HASH=$(git -C "$SCRIPT_DIR" rev-parse HEAD)
git -C "$SCRIPT_DIR" pull --ff-only
AFTER_HASH=$(git -C "$SCRIPT_DIR" rev-parse HEAD)

if [ "$BEFORE_HASH" = "$AFTER_HASH" ] && [ "$FORCE" = false ]; then
  ok "Already up to date ($(git rev-parse --short HEAD)). Nothing to do."
  echo "  Use --force to rebuild & reload anyway."
  exit 0
fi

if [ "$BEFORE_HASH" != "$AFTER_HASH" ]; then
  echo "  Updated: $(git rev-parse --short "$BEFORE_HASH") → $(git rev-parse --short "$AFTER_HASH")"
  git log --oneline "${BEFORE_HASH}..${AFTER_HASH}" | head -10 | sed 's/^/    /'
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2 — Backend dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[2/5] Backend dependencies"
cd "$SCRIPT_DIR/backend"
npm install --production --quiet
ok "Backend deps up to date"
cd "$SCRIPT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3 — Frontend dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[3/5] Frontend dependencies"
cd "$SCRIPT_DIR/frontend"
npm install --quiet
ok "Frontend deps up to date"
cd "$SCRIPT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4 — Rebuild frontend
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if [ "$SKIP_BUILD" = true ]; then
  warn "[4/5] Skipping frontend build (--skip-build)"
else
  log "[4/5] Building frontend (production)"
  cd "$SCRIPT_DIR/frontend"
  NODE_ENV=production npm run build
  ok "Frontend built → frontend/build/"
  cd "$SCRIPT_DIR"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5 — Reload PM2 (zero-downtime)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[5/5] Reload PM2 processes"

if [ "$NO_RESTART" = true ]; then
  warn "Skipping PM2 reload (--no-restart). Reload manually:"
  echo "    pm2 reload api"
  echo "    pm2 reload frontend"
else
  # ── Backend cluster (zero-downtime reload, one worker at a time) ─────────
  if pm2 describe api &>/dev/null; then
    pm2 reload api --update-env
    sleep 1
    API_STATUS=$(pm2 jlist 2>/dev/null | python3 -c \
      "import sys,json; ps=[p for p in json.load(sys.stdin) if p['name']=='api']; \
       statuses=set(p['pm2_env']['status'] for p in ps); print('online' if statuses=={'online'} else 'degraded')" \
      2>/dev/null || echo "unknown")
    ok "PM2 'api' reloaded — status: ${API_STATUS}"
  else
    warn "PM2 process 'api' not found. Run setup.sh first to start it."
  fi

  # ── Frontend static server ───────────────────────────────────────────────
  if pm2 describe frontend &>/dev/null; then
    pm2 reload frontend
    ok "PM2 'frontend' reloaded"
  else
    warn "PM2 process 'frontend' not found. Run setup.sh first to start it."
  fi

  # ── Persist updated process list ─────────────────────────────────────────
  pm2 save --force &>/dev/null
  ok "PM2 process list saved"

  # ── Status snapshot ───────────────────────────────────────────────────────
  echo ""
  pm2 list || true
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Summary
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VM_IP=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Update Complete!${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
echo "  Revision : $(git rev-parse --short HEAD)"
echo "  Frontend → https://myproj.tld  (or https://${VM_IP})"
echo "  API      → https://api.myproj.tld/health"
echo "  Status   → https://status.myproj.tld"
echo ""
echo "  Logs:"
echo "    pm2 logs api"
echo "    tail -f $SCRIPT_DIR/backend/logs/pm2-api.log"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
