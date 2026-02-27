#!/bin/bash
# IT Change / Incident Logger - Production Setup Script
# Ubuntu minimal, no Docker, no interactive prompts
# Single port: 4000

set -euo pipefail

echo "========================================="
echo "  IT Change / Incident Logger - Setup"
echo "========================================="

# ── Step 1: System packages ────────────────────────────────────────────────────
echo "[1/8] Installing system packages..."
export DEBIAN_FRONTEND=noninteractive

# remove or correct any existing MongoDB repo that references an unsupported codename
if [ -f "/etc/apt/sources.list.d/mongodb-org-7.0.list" ]; then
  # replace known problematic codenames such as noble with jammy so initial update succeeds
  sed -i 's|noble|jammy|g' /etc/apt/sources.list.d/mongodb-org-7.0.list || true
fi

apt-get update -qq
apt-get install -y -q curl wget gnupg2 lsb-release ca-certificates python3 make g++ git

# ── Step 2: Node.js LTS ────────────────────────────────────────────────────────
echo "[2/8] Installing Node.js LTS..."
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -q nodejs
fi
node --version
npm --version

# ── Step 3: MongoDB ────────────────────────────────────────────────────────────
echo "[3/8] Installing MongoDB..."
if ! command -v mongod &>/dev/null; then
  UBUNTU_CODENAME=$(lsb_release -sc)
  # MongoDB packaging lags behind Ubuntu releases; newer codenames (noble,
  # lunar, etc.) aren’t yet published by the upstream repo.  Always fall back to
  # a known supported release (jammy) when we detect an unsupported codename.
  #
  # The pre-update patch above already normalises any existing list file, but we
  # also guard here in case the script is run interactively on a clean system.
  case "${UBUNTU_CODENAME}" in
    jammy|focal|bionic|xenial)
      MONGO_CODENAME="${UBUNTU_CODENAME}"
      ;;
    *)
      echo "[3/8] Warning: Ubuntu codename '${UBUNTU_CODENAME}' is not
      supported by the MongoDB repo; using 'jammy' instead."
      MONGO_CODENAME="jammy"
      ;;
  esac

  # ensure we start with a fresh repository file
  if [ -f "/etc/apt/sources.list.d/mongodb-org-7.0.list" ]; then
    rm -f "/etc/apt/sources.list.d/mongodb-org-7.0.list"
  fi

  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
  # try updating package list; if it fails and we weren't already using the
  # jammy codename, try again using jammy. this helps when UBUNTU_CODENAME was
  # a newer unsupported name like "noble".
  if ! apt-get update -qq; then
    if [ "${MONGO_CODENAME}" != "jammy" ]; then
      echo "[3/8] Initial apt update failed for '${MONGO_CODENAME}', retrying with 'jammy'..."
      echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
      apt-get update -qq
    else
      echo "[3/8] apt update failed even for codename '${MONGO_CODENAME}'." >&2
      echo "Please check your network or the repository manually." >&2
      exit 1
    fi
  fi

  apt-get install -y -q mongodb-org
fi
systemctl enable mongod
systemctl start mongod || true
sleep 2
echo "MongoDB status: $(systemctl is-active mongod)"

# ── Step 4: PM2 ────────────────────────────────────────────────────────────────
echo "[4/8] Installing PM2..."
npm install -g pm2 --quiet

# ── Step 5: Install dependencies ──────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "[5/8] Installing backend dependencies..."
cd backend
npm install --production --quiet
cd ..

echo "      Installing frontend dependencies..."
cd frontend
npm install --quiet
cd ..

# ── Step 6: Credit injection ───────────────────────────────────────────────────
echo "[6/8] Injecting credits into About and Terms pages..."

UTC_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

ABOUT_FILE="frontend/src/pages/About.js"
TERMS_FILE="frontend/src/pages/Terms.js"

# ── About page injection ───────────────────────────────────────────────────────
# Find the first occurrence of the target heading and inject credits immediately after
# Target: <h2>About this application</h2>
# Replace the INJECTED_UTC_TIMESTAMP placeholder with real timestamp

if ! grep -q 'https://github.com/utsav-mistry' "$ABOUT_FILE"; then
  echo "  About.jsx: Credits block missing, injecting now..."
  # Inject credits block after the heading
  python3 - <<PYEOF
import re, sys

with open('${ABOUT_FILE}', 'r') as f:
    content = f.read()

target = '<h2>About this application</h2>'
injection = '''<h2>About this application</h2>
          <h3>Credits</h3>
<p>
  Developed by <strong>Utsav Mistry</strong><br/>
  GitHub: <a href="https://github.com/utsav-mistry" target="_blank" rel="noreferrer">
    https://github.com/utsav-mistry
  </a>
</p>
<p>
  Deployed at: <strong>${UTC_TIMESTAMP}</strong>
</p>'''

if target in content:
    content = content.replace(target, injection, 1)
    with open('${ABOUT_FILE}', 'w') as f:
        f.write(content)
    print('  About.jsx: Credits injected successfully')
else:
    print('ERROR: Target heading not found in About.jsx', file=sys.stderr)
    sys.exit(1)
PYEOF
else
  echo "  About.jsx: Credits block already present, updating timestamp..."
  # Update the INJECTED_UTC_TIMESTAMP placeholder if still present
  if grep -q 'INJECTED_UTC_TIMESTAMP' "$ABOUT_FILE"; then
    sed -i "s/INJECTED_UTC_TIMESTAMP/${UTC_TIMESTAMP}/g" "$ABOUT_FILE"
    echo "  About.jsx: Timestamp updated"
  fi
fi

# ── Terms page injection ───────────────────────────────────────────────────────
# Target: <h2>Terms and Conditions</h2>
# Inject the attribution block immediately after it

if ! grep -q 'https://github.com/utsav-mistry' "$TERMS_FILE"; then
  echo "  Terms.jsx: Attribution block missing, injecting now..."
  python3 - <<PYEOF
import re, sys

with open('${TERMS_FILE}', 'r') as f:
    content = f.read()

target = '<h2>Terms and Conditions</h2>'
injection = '''<h2>Terms and Conditions</h2>
      <p style={{ marginTop: "12px" }}>
  This software is developed by <strong>Utsav Mistry</strong>.<br/>
  GitHub: <a href="https://github.com/utsav-mistry" target="_blank" rel="noreferrer">
    https://github.com/utsav-mistry
  </a>
</p>'''

if target in content:
    content = content.replace(target, injection, 1)
    with open('${TERMS_FILE}', 'w') as f:
        f.write(content)
    print('  Terms.jsx: Attribution injected successfully')
else:
    print('ERROR: Target heading not found in Terms.jsx', file=sys.stderr)
    sys.exit(1)
PYEOF
else
  echo "  Terms.jsx: Attribution block already present"
fi

# ── Step 6b: Verification ─────────────────────────────────────────────────────
echo "      Verifying credit injection..."

ABOUT_OK=$(grep -c 'https://github.com/utsav-mistry' "$ABOUT_FILE" || true)
TERMS_OK=$(grep -c 'https://github.com/utsav-mistry' "$TERMS_FILE" || true)

if [ "$ABOUT_OK" -lt 1 ]; then
  echo "FATAL: Credit URL not found in About.jsx after injection. Setup aborted."
  exit 1
fi

if [ "$TERMS_OK" -lt 1 ]; then
  echo "FATAL: Credit URL not found in Terms.jsx after injection. Setup aborted."
  exit 1
fi

echo "  Verification PASSED: Credits found in both files."

# ── Step 7: Build frontend ────────────────────────────────────────────────────
echo "[7/8] Building frontend (production)..."
cd frontend
NODE_ENV=production npm run build
cd ..
echo "      Frontend build complete."

# ── Step 8: Generate env file & start backend ─────────────────────────────────
echo "[8/8] Configuring and starting backend with PM2..."

# Generate a secure JWT secret
JWT_SECRET=$(node -e "const crypto = require('crypto'); console.log(crypto.randomBytes(48).toString('hex'));")

# Write production .env
cat > backend/.env <<ENVEOF
NODE_ENV=production
PORT=4000
MONGO_URI=mongodb://localhost:27017/it_change_logger
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
ENVEOF

echo "      JWT secret generated and saved."

# Create logs directory
mkdir -p backend/logs

# Stop any existing PM2 process
pm2 delete it-change-logger 2>/dev/null || true

# Start with PM2
pm2 start backend/src/server.js \
  --name it-change-logger \
  --env production \
  --max-memory-restart 512M \
  --restart-delay 3000 \
  --log "$SCRIPT_DIR/backend/logs/pm2.log" \
  --error "$SCRIPT_DIR/backend/logs/pm2-error.log" \
  --time

# Save PM2 process list for auto-restart on boot
pm2 save

# Enable PM2 on system boot
pm2 startup systemd -u root --hp /root 2>/dev/null || \
  pm2 startup | tail -1 | bash || true

echo ""
echo "========================================="
echo "  Setup Complete!"
echo "========================================="
echo "  App URL:    http://$(hostname -I | awk '{print $1}'):4000"
echo "  PM2 Status: $(pm2 status it-change-logger 2>/dev/null | grep it-change-logger | awk '{print $10}' || echo 'check with: pm2 status')"
echo ""
echo "  First time? Open the app URL in your browser to complete"
echo "  the initial company setup wizard."
echo ""
echo "  Logs:"
echo "    App:   $SCRIPT_DIR/backend/logs/"
echo "    PM2:   pm2 logs it-change-logger"
echo "========================================="

# ── Make update.sh executable ──────────────────────────────────────────────────
chmod +x "$SCRIPT_DIR/update.sh" 2>/dev/null || true

echo ""
echo "========================================="
echo "  Auto-Update Setup"
echo "========================================="
echo "  Run updates manually any time:"
echo "    $SCRIPT_DIR/update.sh"
echo ""
echo "  To schedule automatic updates via cron, run:"
echo "    crontab -e"
echo ""
echo "  Then add ONE of the following lines:"
echo ""
echo "  # Update nightly at 2:30 AM (recommended for most setups):"
echo "  30 2 * * * $SCRIPT_DIR/update.sh >> $SCRIPT_DIR/backend/logs/update.log 2>&1"
echo ""
echo "  # Update every Sunday at 3:00 AM (low-traffic setups):"
echo "  0 3 * * 0 $SCRIPT_DIR/update.sh >> $SCRIPT_DIR/backend/logs/update.log 2>&1"
echo ""
echo "  Update log: $SCRIPT_DIR/backend/logs/update.log"
echo "========================================="

