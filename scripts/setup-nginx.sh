#!/usr/bin/env bash
set -euo pipefail

# Configure host nginx to proxy port 80 → Docker API on 127.0.0.1:API_HOST_PORT
# Usage: sudo ./scripts/setup-nginx.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF_SRC="${ROOT_DIR}/deploy/nginx/eudr-platform.conf"
SNIPPETS_SRC="${ROOT_DIR}/deploy/nginx/snippets"
ENV_FILE="${ROOT_DIR}/.env"

# shellcheck source=lib/production-env.sh
source "${ROOT_DIR}/scripts/lib/production-env.sh"

API_HOST_PORT="$(production_env_get API_HOST_PORT 2>/dev/null || echo 3000)"
API_HOST_PORT="$(production_sanitize_port "$API_HOST_PORT")"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo $0"
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "nginx is not installed."
  if command -v apt-get >/dev/null 2>&1; then
    apt-get update && apt-get install -y nginx
  elif command -v yum >/dev/null 2>&1; then
    yum install -y nginx
  else
    echo "Install nginx manually, then re-run this script."
    exit 1
  fi
fi

mkdir -p /etc/nginx/snippets
cp "${SNIPPETS_SRC}/"*.conf /etc/nginx/snippets/

RENDERED="$(mktemp)"
# Use | delimiter — API_HOST_PORT must be digits only (see production_sanitize_port)
sed "s|__API_HOST_PORT__|${API_HOST_PORT}|g" "$CONF_SRC" > "$RENDERED"

if [[ -d /etc/nginx/sites-available ]]; then
  cp "$RENDERED" /etc/nginx/sites-available/eudr-platform.conf
  ln -sf /etc/nginx/sites-available/eudr-platform.conf /etc/nginx/sites-enabled/eudr-platform.conf
  rm -f /etc/nginx/sites-enabled/default
elif [[ -d /etc/nginx/conf.d ]]; then
  cp "$RENDERED" /etc/nginx/conf.d/eudr-platform.conf
  rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true
else
  echo "Unsupported nginx layout. Copy ${CONF_SRC} manually."
  exit 1
fi
rm -f "$RENDERED"

nginx -t
systemctl enable nginx
systemctl reload nginx

echo ""
echo "Nginx configured (API upstream → 127.0.0.1:${API_HOST_PORT}):"
echo "  Platform:  http://YOUR_SERVER_IP:8003/"
echo "  Superset:  http://YOUR_SERVER_IP:8003/superset/  (requires ENABLE_WAREHOUSE=true)"
echo ""
echo "Optional — install fail2ban bot protection:"
echo "  sudo cp deploy/fail2ban/*.conf /etc/fail2ban/filter.d/"
echo "  sudo cp deploy/fail2ban/jail.local.example /etc/fail2ban/jail.d/eudr.local"
echo "  sudo systemctl restart fail2ban"
