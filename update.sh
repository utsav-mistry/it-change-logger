#!/bin/bash
# IT Change / Incident Logger - Application Update Script
# Safe to run at any time: pulls latest code, installs deps, rebuilds frontend, restarts backend
# Usage:
#   ./update.sh           — standard update
#   ./update.sh --force   — skip git clean check and update regardless of local changes
#   ./update.sh --no-restart — update without restarting the PM2 process

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

FORCE=false
NO_RESTART=false
for arg in "$@"; do
  case "$arg" in
    --force)      FORCE=true ;;
    --no-restart) NO_RESTART=true ;;
  esac
done

echo "========================================="
echo "  IT Change / Incident Logger - Update"
echo "  $(date '+%Y-%m-%d %H:%M:%S %Z')"
echo "========================================="

# ── Step 1: Git pull ──────────────────────────────────────────────────────────
echo "[1/5] Pulling latest code from git..."

if ! git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree &>/dev/null; then
  echo "ERROR: Not a git repository. Cannot auto-update."
  echo "       If you installed by other means, update files manually and re-run:"
  echo "       cd frontend && npm install && npm run build"
  echo "       cd ../backend && npm install --production"
  echo "       pm2 restart it-change-logger"
  exit 1
fi

# Warn about local changes unless --force
if [ "$FORCE" = false ]; then
  if ! git -C "$SCRIPT_DIR" diff --quiet || ! git -C "$SCRIPT_DIR" diff --cached --quiet; then
    echo ""
    echo "WARNING: You have uncommitted local changes."
    echo "         These may be overwritten by the update."
    echo "         Run with --force to update anyway, or commit/stash your changes first."
    echo ""
    read -r -p "Continue anyway? [y/N] " response
    case "$response" in
      [yY][eE][sS]|[yY]) ;;
      *) echo "Update cancelled."; exit 0 ;;
    esac
  fi
fi

BEFORE_HASH=$(git -C "$SCRIPT_DIR" rev-parse HEAD)
git -C "$SCRIPT_DIR" pull --ff-only
AFTER_HASH=$(git -C "$SCRIPT_DIR" rev-parse HEAD)

if [ "$BEFORE_HASH" = "$AFTER_HASH" ]; then
  echo "      Already up to date ($(git rev-parse --short HEAD))."
  echo ""
  echo "  Nothing changed. Exiting."
  echo "  Use --force to rebuild anyway."
  exit 0
fi

echo "      Updated: $(git rev-parse --short "$BEFORE_HASH") → $(git rev-parse --short "$AFTER_HASH")"
git log --oneline "${BEFORE_HASH}..${AFTER_HASH}" | head -10 | sed 's/^/        /'

# ── Step 2: Backend dependencies ──────────────────────────────────────────────
echo "[2/5] Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm install --production --quiet
cd "$SCRIPT_DIR"

# ── Step 3: Frontend dependencies ─────────────────────────────────────────────
echo "[3/5] Installing frontend dependencies..."
cd "$SCRIPT_DIR/frontend"
npm install --quiet
cd "$SCRIPT_DIR"

# ── Step 4: Rebuild frontend ──────────────────────────────────────────────────
echo "[4/5] Building frontend (production)..."
cd "$SCRIPT_DIR/frontend"
NODE_ENV=production npm run build
cd "$SCRIPT_DIR"
echo "      Frontend build complete."

# ── Step 5: Restart backend ───────────────────────────────────────────────────
if [ "$NO_RESTART" = true ]; then
  echo "[5/5] Skipping restart (--no-restart flag set)."
  echo "      Restart manually: pm2 restart it-change-logger"
else
  echo "[5/5] Restarting backend with PM2..."
  if pm2 describe it-change-logger &>/dev/null; then
    pm2 restart it-change-logger --update-env
    sleep 2
    STATUS=$(pm2 describe it-change-logger 2>/dev/null | grep -i "status" | head -1 | awk '{print $NF}' || echo "unknown")
    echo "      PM2 status: $STATUS"
  else
    echo "WARNING: PM2 process 'it-change-logger' not found."
    echo "         Start it with: pm2 start $SCRIPT_DIR/backend/src/server.js --name it-change-logger"
  fi
fi

echo ""
echo "========================================="
echo "  Update Complete!"
echo "  Revision: $(git rev-parse --short HEAD)"
echo "  App URL:  http://$(hostname -I | awk '{print $1}' 2>/dev/null || echo 'localhost'):4000"
echo "========================================="
