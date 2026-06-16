#!/usr/bin/env bash
# Quick diagnostics when nginx returns 502 Bad Gateway
set -euo pipefail

echo "=== EUDR 502 diagnostics ==="
echo ""

echo "1. Nginx status"
systemctl is-active nginx 2>/dev/null || echo "nginx: unknown"
echo ""

echo "2. Port 3000 listeners"
ss -tlnp 2>/dev/null | grep ':3000' || echo "  nothing listening on :3000 (this causes 502)"
echo ""

echo "3. API health (direct)"
curl -sf "http://127.0.0.1:3000/api/health" 2>/dev/null && echo "" || echo "  FAILED — API not reachable on 127.0.0.1:3000"
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
echo "  Ensure .env does NOT set PORT=8003 (public URL port ≠ API port)"
