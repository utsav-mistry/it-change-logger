#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  IT Change Logger — Production Setup Script
#  Target OS : Ubuntu Server 20.04 / 22.04 / 24.04 (x86_64 or arm64)
#  Design    : Fully idempotent — safe to run multiple times
#  Services  : Node.js LTS · MongoDB · PM2 (cluster) · NGINX · UFW
#  Domains   : myproj.tld · api.myproj.tld · status.myproj.tld
# ══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colours ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

log()  { echo -e "${CYAN}[setup]${RESET} $*"; }
ok()   { echo -e "${GREEN}  ✔ $*${RESET}"; }
warn() { echo -e "${YELLOW}  ⚠ $*${RESET}"; }
fail() { echo -e "${RED}  ✖ $*${RESET}"; exit 1; }

# ── Root check ────────────────────────────────────────────────────────────────
[ "$(id -u)" -eq 0 ] || fail "This script must be run as root (sudo ./setup.sh)"

# ── Resolve project root (directory containing this script) ──────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}  IT Change Logger — Production Setup${RESET}"
echo -e "${BOLD}══════════════════════════════════════════════════${RESET}"
echo ""

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 1 — System packages
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[1/10] System packages"
export DEBIAN_FRONTEND=noninteractive

# Fix any broken MongoDB repo codename from previous runs
if [ -f "/etc/apt/sources.list.d/mongodb-org-7.0.list" ]; then
  sed -i 's|noble|jammy|g; s|lunar|jammy|g; s|kinetic|jammy|g' \
      /etc/apt/sources.list.d/mongodb-org-7.0.list 2>/dev/null || true
fi

apt-get update -qq
apt-get install -y -q \
    curl wget gnupg2 lsb-release ca-certificates \
    python3 make g++ git openssl ufw nginx
ok "System packages ready"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 2 — Node.js LTS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[2/10] Node.js LTS"
if ! command -v node &>/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y -q nodejs
  ok "Node.js $(node --version) installed"
else
  ok "Node.js $(node --version) already installed"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 3 — MongoDB
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[3/10] MongoDB"
if ! command -v mongod &>/dev/null; then
  UBUNTU_CODENAME=$(lsb_release -sc)
  case "${UBUNTU_CODENAME}" in
    jammy|focal|bionic|xenial) MONGO_CODENAME="${UBUNTU_CODENAME}" ;;
    *)
      warn "Ubuntu '${UBUNTU_CODENAME}' not in MongoDB upstream; falling back to 'jammy'"
      MONGO_CODENAME="jammy"
      ;;
  esac

  rm -f /etc/apt/sources.list.d/mongodb-org-7.0.list
  curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
    | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
  echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
https://repo.mongodb.org/apt/ubuntu ${MONGO_CODENAME}/mongodb-org/7.0 multiverse" \
    | tee /etc/apt/sources.list.d/mongodb-org-7.0.list

  if ! apt-get update -qq; then
    warn "apt update failed for '${MONGO_CODENAME}', retrying with 'jammy'…"
    sed -i "s|${MONGO_CODENAME}|jammy|g" /etc/apt/sources.list.d/mongodb-org-7.0.list
    apt-get update -qq
  fi
  apt-get install -y -q mongodb-org
  ok "MongoDB installed"
else
  ok "MongoDB already installed"
fi

systemctl enable mongod
systemctl start mongod || true
sleep 2
MONGO_STATE=$(systemctl is-active mongod)
[ "$MONGO_STATE" = "active" ] && ok "MongoDB running" || warn "MongoDB state: $MONGO_STATE"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 4 — PM2 + serve
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[4/10] PM2 + serve"
npm install -g pm2 serve --quiet
ok "PM2 $(pm2 --version) + serve installed"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 5 — Install dependencies
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[5/10] Installing dependencies"
cd "$SCRIPT_DIR"

log "  Backend…"
cd backend && npm install --production --quiet && cd ..
ok "Backend deps installed"

log "  Frontend…"
cd frontend && npm install --quiet && cd ..
ok "Frontend deps installed"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 6 — Credit injection (About & Terms pages)
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[6/10] Injecting credits"
UTC_TIMESTAMP=$(date -u '+%Y-%m-%d %H:%M:%S UTC')
ABOUT_FILE="$SCRIPT_DIR/frontend/src/pages/About.js"
TERMS_FILE="$SCRIPT_DIR/frontend/src/pages/Terms.js"

inject_credits() {
  local file="$1" target="$2" injection="$3" label="$4"
  if ! grep -q 'https://github.com/utsav-mistry' "$file" 2>/dev/null; then
    python3 - <<PYEOF
import sys
with open('${file}', 'r') as f:
    c = f.read()
if '${target}' in c:
    c = c.replace('${target}', '${injection}', 1)
    with open('${file}', 'w') as f:
        f.write(c)
    print('  ${label}: Credits injected')
else:
    print('  ${label}: Target heading not found — skip', file=sys.stderr)
PYEOF
  else
    ok "  ${label}: Credits already present"
  fi
}

if [ -f "$ABOUT_FILE" ]; then
  inject_credits "$ABOUT_FILE" \
    "<h2>About this application</h2>" \
    "<h2>About this application</h2><p>Developed by <strong>Utsav Mistry</strong> — <a href='https://github.com/utsav-mistry'>github.com/utsav-mistry</a>. Deployed: ${UTC_TIMESTAMP}</p>" \
    "About.js"
fi

if [ -f "$TERMS_FILE" ]; then
  inject_credits "$TERMS_FILE" \
    "<h2>Terms and Conditions</h2>" \
    "<h2>Terms and Conditions</h2><p>Software by <strong>Utsav Mistry</strong> — <a href='https://github.com/utsav-mistry'>github.com/utsav-mistry</a></p>" \
    "Terms.js"
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 7 — Build frontend
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[7/10] Building frontend"
cd "$SCRIPT_DIR/frontend"
NODE_ENV=production npm run build
ok "Frontend built → frontend/build/"
cd "$SCRIPT_DIR"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 8 — Environment file + backend start
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[8/10] Environment & PM2"
mkdir -p "$SCRIPT_DIR/backend/logs"

# Generate JWT secret only if .env doesn't already have one
if [ ! -f "$SCRIPT_DIR/backend/.env" ] || ! grep -q 'JWT_SECRET' "$SCRIPT_DIR/backend/.env"; then
  JWT_SECRET=$(node -e "const c=require('crypto');console.log(c.randomBytes(48).toString('hex'));")
  cat > "$SCRIPT_DIR/backend/.env" <<ENVEOF
NODE_ENV=production
PORT=5000
HOST=127.0.0.1
MONGO_URI=mongodb://localhost:27017/it_change_logger
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES=8h
IDEMPOTENCY_TTL_MS=600000
ENVEOF
  ok ".env created with fresh JWT secret"
else
  ok ".env already present — skipping regeneration"
fi

# ── Start PM2 processes (idempotent) ─────────────────────────────────────────
# Backend: cluster mode, 2 instances
if pm2 describe api &>/dev/null; then
  log "  PM2 'api' exists — reloading…"
  pm2 reload api --update-env
  ok "PM2 'api' reloaded"
else
  pm2 start "$SCRIPT_DIR/backend/src/server.js" \
    --name api \
    -i 2 \
    --env production \
    --max-memory-restart 512M \
    --restart-delay 3000 \
    --log  "$SCRIPT_DIR/backend/logs/pm2-api.log" \
    --error "$SCRIPT_DIR/backend/logs/pm2-api-error.log" \
    --time
  ok "PM2 'api' started (cluster×2 on :5000)"
fi

# Frontend: PM2 serve (SPA mode)
if pm2 describe frontend &>/dev/null; then
  log "  PM2 'frontend' exists — reloading…"
  pm2 reload frontend
  ok "PM2 'frontend' reloaded"
else
  pm2 start serve \
    --name frontend \
    -- -s "$SCRIPT_DIR/frontend/build" -l 3000 \
    --log  "$SCRIPT_DIR/backend/logs/pm2-frontend.log" \
    --error "$SCRIPT_DIR/backend/logs/pm2-frontend-error.log" \
    --time
  ok "PM2 'frontend' started on :3000"
fi

pm2 save
ok "PM2 process list saved"

# Persist PM2 across reboots
pm2 startup systemd -u root --hp /root 2>/dev/null || \
  (pm2 startup | tail -1 | bash) || true
ok "PM2 startup hook configured"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 9 — SSL certificates
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[9/10] SSL certificates"

CERT_KEY="/etc/ssl/private/myproj.key"
CERT_CRT="/etc/ssl/certs/myproj.crt"

# Detect whether myproj.tld resolves to a public IP (=> use Let's Encrypt)
VM_IP=$(hostname -I | awk '{print $1}')
DOMAIN_IP=$(dig +short myproj.tld A 2>/dev/null | tail -1 || echo "")

USE_CERTBOT=false
if [ -n "$DOMAIN_IP" ] && [ "$DOMAIN_IP" != "$VM_IP" ] && [ "$DOMAIN_IP" != "127.0.0.1" ]; then
  USE_CERTBOT=true
fi

if $USE_CERTBOT; then
  # ── Let's Encrypt path ───────────────────────────────────────────────────
  log "  Domain resolves publicly — using Let's Encrypt"
  if [ ! -d "/etc/letsencrypt/live/myproj.tld" ]; then
    apt-get install -y -q certbot python3-certbot-nginx
    # Ensure port 80 is open for ACME challenge
    ufw allow 80/tcp >/dev/null 2>&1 || true
    mkdir -p /var/www/letsencrypt
    certbot --nginx \
      -d myproj.tld -d api.myproj.tld -d status.myproj.tld \
      --non-interactive --agree-tos -m admin@myproj.tld \
      --redirect
    ok "Let's Encrypt certificates issued"
    # Certbot auto-renewal
    systemctl enable certbot.timer 2>/dev/null || true
    ok "Certbot auto-renewal enabled"
  else
    ok "Let's Encrypt certs already present — skipping"
  fi
  # Point NGINX config to LE certs
  LE_CERT="/etc/letsencrypt/live/myproj.tld/fullchain.pem"
  LE_KEY="/etc/letsencrypt/live/myproj.tld/privkey.pem"
  CERT_CRT="$LE_CERT"
  CERT_KEY="$LE_KEY"
else
  # ── Self-signed fallback ─────────────────────────────────────────────────
  log "  Domain not publicly resolvable — generating self-signed cert"
  if [ ! -f "$CERT_KEY" ] || [ ! -f "$CERT_CRT" ]; then
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
      -keyout "$CERT_KEY" \
      -out    "$CERT_CRT" \
      -subj "/C=US/ST=Local/L=Local/O=MyProj/OU=Dev/CN=myproj.tld" \
      -addext "subjectAltName=DNS:myproj.tld,DNS:api.myproj.tld,DNS:status.myproj.tld,IP:${VM_IP}" \
      2>/dev/null
    chmod 600 "$CERT_KEY"
    ok "Self-signed certificate generated (365 days)"
  else
    ok "Self-signed certificate already present — skipping"
  fi
fi

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# STEP 10 — NGINX + UFW
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
log "[10/10] NGINX + UFW"

# ── WebSocket map (add to http block if missing) ──────────────────────────────
NGINX_CONF="/etc/nginx/nginx.conf"
if ! grep -q 'connection_upgrade' "$NGINX_CONF"; then
  sed -i '/^http {/a \    map $http_upgrade $connection_upgrade {\n        default upgrade;\n        '\'''\''      close;\n    }' "$NGINX_CONF"
  ok "WebSocket upgrade map added to nginx.conf"
fi

# ── Status page docs root ─────────────────────────────────────────────────────
mkdir -p /var/www/status
cp "$SCRIPT_DIR/status-page/index.html" /var/www/status/index.html
ok "Status page deployed → /var/www/status/"

# ── ACME challenge root ───────────────────────────────────────────────────────
mkdir -p /var/www/letsencrypt

# ── Deploy site config ────────────────────────────────────────────────────────
SITE_SRC="$SCRIPT_DIR/nginx/myproj.conf"
SITE_DST="/etc/nginx/sites-available/myproj"
SITE_LINK="/etc/nginx/sites-enabled/myproj"

# Substitute cert paths into the config before copying
sed \
  "s|/etc/ssl/certs/myproj.crt|${CERT_CRT}|g; \
   s|/etc/ssl/private/myproj.key|${CERT_KEY}|g" \
  "$SITE_SRC" > "$SITE_DST"

# Remove the default NGINX site (conflicts on port 80/443)
rm -f /etc/nginx/sites-enabled/default

# Create symlink (idempotent)
ln -sfn "$SITE_DST" "$SITE_LINK"
ok "NGINX site config deployed → $SITE_DST"

# Validate config
nginx -t && systemctl reload nginx
ok "NGINX reloaded"

# ── UFW firewall ──────────────────────────────────────────────────────────────
log "  Configuring UFW…"
ufw --force reset >/dev/null 2>&1      # wipe stale rules
ufw default deny incoming  >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp   comment "SSH"       >/dev/null
ufw allow 80/tcp   comment "HTTP"      >/dev/null
ufw allow 443/tcp  comment "HTTPS"     >/dev/null
ufw --force enable  >/dev/null
ok "UFW active: allow 22 80 443 / block all others"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Print summary + /etc/hosts instructions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VM_IP=$(hostname -I | awk '{print $1}')

chmod +x "$SCRIPT_DIR/update.sh" 2>/dev/null || true

echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
echo -e "${BOLD}${GREEN}  Setup Complete!${RESET}"
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
echo ""
echo -e "${BOLD}Service URLs:${RESET}"
echo "  Frontend  → https://myproj.tld"
echo "  API       → https://api.myproj.tld"
echo "  Status    → https://status.myproj.tld"
echo ""
echo -e "${BOLD}API Health checks:${RESET}"
echo "  https://api.myproj.tld/health"
echo "  https://api.myproj.tld/ready"
echo ""
echo -e "${BOLD}PM2 status:${RESET}"
pm2 list || true
echo ""

if ! $USE_CERTBOT; then
  echo -e "${YELLOW}════════════════════════════════════════════════════${RESET}"
  echo -e "${YELLOW}  LOCAL / VM SIMULATION — /etc/hosts setup${RESET}"
  echo -e "${YELLOW}════════════════════════════════════════════════════${RESET}"
  echo ""
  echo "  VM IP detected: ${BOLD}${VM_IP}${RESET}"
  echo ""
  echo -e "  Add the following lines to your ${BOLD}host machine's${RESET} /etc/hosts:"
  echo ""
  echo -e "  ${CYAN}${VM_IP}  myproj.tld${RESET}"
  echo -e "  ${CYAN}${VM_IP}  api.myproj.tld${RESET}"
  echo -e "  ${CYAN}${VM_IP}  status.myproj.tld${RESET}"
  echo ""
  echo "  On Linux/macOS: sudo nano /etc/hosts"
  echo "  On Windows:     C:\\Windows\\System32\\drivers\\etc\\hosts  (run as Admin)"
  echo ""
  echo -e "  ${YELLOW}⚠  Browser will show a self-signed cert warning.${RESET}"
  echo "     Click 'Advanced → Proceed' to continue to the site."
  echo ""
fi

echo -e "${BOLD}Logs:${RESET}"
echo "  App:    $SCRIPT_DIR/backend/logs/"
echo "  NGINX:  /var/log/nginx/"
echo "  PM2:    pm2 logs"
echo ""
echo -e "${BOLD}Useful commands:${RESET}"
echo "  pm2 status          — process overview"
echo "  pm2 logs api        — backend logs"
echo "  pm2 reload api      — zero-downtime reload"
echo "  ./update.sh         — pull + rebuild + reload"
echo ""
echo -e "${BOLD}${GREEN}══════════════════════════════════════════════════${RESET}"
