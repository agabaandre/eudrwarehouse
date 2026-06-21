#!/usr/bin/env bash
set -euo pipefail

# Diagnose Superset nginx proxy and container health.
# Usage: ./scripts/diagnose-superset.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/production-env.sh
source "${ROOT_DIR}/scripts/lib/production-env.sh"

API_PORT="$(production_env_get API_HOST_PORT 2>/dev/null || echo 3000)"
API_PORT="$(production_sanitize_port "$API_PORT")"
SS_PORT="$(production_env_get SUPERSET_HOST_PORT 2>/dev/null || echo 8088)"
SS_PORT="$(production_sanitize_port "$SS_PORT")"
WAREHOUSE="$(production_env_get ENABLE_WAREHOUSE 2>/dev/null || echo false)"
PUBLIC="$(production_env_get PUBLIC_BASE_URL 2>/dev/null || echo http://127.0.0.1:8003)"

echo "=== Superset diagnostics ==="
echo "  ENABLE_WAREHOUSE: ${WAREHOUSE}"
echo "  SUPERSET_HOST_PORT: ${SS_PORT}"
echo "  PUBLIC_BASE_URL: ${PUBLIC}"
echo ""

if [[ "${WAREHOUSE}" != "true" ]]; then
  echo "ERROR: Warehouse stack is off. Superset requires:"
  echo "  export ENABLE_WAREHOUSE=true"
  echo "  ./scripts/deploy.sh"
  exit 1
fi

echo "--- Docker containers ---"
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  -f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml ps superset 2>/dev/null || true
echo ""

echo "--- Direct Superset (inside host, port ${SS_PORT}) ---"
for path in /health /login/ /welcome/; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${SS_PORT}${path}" 2>/dev/null || echo '000')"
  echo "  http://127.0.0.1:${SS_PORT}${path} → HTTP ${code}"
done
echo ""

echo "--- Via nginx (port 8003 public path) ---"
for path in /superset/login/ /superset/welcome/ /superset/health; do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:8003${path}" 2>/dev/null || echo '000')"
  echo "  http://127.0.0.1:8003${path} → HTTP ${code}"
done
echo ""

echo "--- Recent Superset logs ---"
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  -f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml logs superset --tail 25 2>/dev/null || true
echo ""

echo "If direct /login/ works but /superset/login/ returns 404, re-run:"
echo "  sudo ./scripts/setup-nginx.sh"
echo "If direct /login/ fails, rebuild Superset:"
echo "  docker compose -f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml up -d --build superset"
