#!/usr/bin/env bash
# Quick diagnostics when nginx returns 502 Bad Gateway
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
API_HOST_PORT=3000
if [[ -f "${ROOT_DIR}/.env" ]] && grep -q '^API_HOST_PORT=' "${ROOT_DIR}/.env" 2>/dev/null; then
  API_HOST_PORT="$(grep '^API_HOST_PORT=' "${ROOT_DIR}/.env" | cut -d= -f2-)"
fi

echo "=== EUDR 502 diagnostics (API_HOST_PORT=${API_HOST_PORT}) ==="
echo ""

echo "1. Nginx status"
systemctl is-active nginx 2>/dev/null || echo "nginx: unknown"
echo ""

echo "2. Port ${API_HOST_PORT} listeners"
ss -tlnp 2>/dev/null | grep ":${API_HOST_PORT}" || echo "  nothing listening on :${API_HOST_PORT} (this causes 502)"
echo ""

echo "3. API health (direct)"
curl -sf "http://127.0.0.1:${API_HOST_PORT}/api/health" 2>/dev/null && echo "" || echo "  FAILED — API not reachable on 127.0.0.1:${API_HOST_PORT}"
echo ""

echo "4. API health (via nginx :80)"
curl -sf "http://127.0.0.1/api/health" 2>/dev/null && echo "" || echo "  FAILED — nginx proxy issue"
echo ""

echo "5. Docker containers"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>/dev/null | grep -E 'api|postgres|redis|NAMES' || docker ps 2>/dev/null | head -10
echo ""

echo "6. API logs (last 40 lines)"
docker logs "$(docker ps -q -f name=api 2>/dev/null | head -1)" --tail 40 2>/dev/null || echo "  no api container found"
echo ""

echo "=== Common fixes ==="
echo "  export ENABLE_WAREHOUSE=false"
echo "  ./scripts/deploy.sh YOUR_SERVER_IP"
echo "  sudo ./scripts/setup-nginx.sh"
echo "  Ensure API_HOST_PORT in .env matches nginx (sudo ./scripts/setup-nginx.sh)"
