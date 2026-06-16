#!/usr/bin/env bash
set -euo pipefail

# Update and redeploy running containers.
# Usage: ./scripts/deploy.sh [SERVER_IP_OR_HOSTNAME]
# Do NOT use sudo — run as a user in the docker group.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ ! -f "${ROOT_DIR}/scripts/lib/production-env.sh" ]]; then
  echo "Error: scripts/lib/production-env.sh not found. Run: git pull origin main"
  exit 1
fi

# shellcheck source=lib/production-env.sh
source "${ROOT_DIR}/scripts/lib/production-env.sh"
production_require_bash
production_warn_root

SERVER_HOST="${1:-${SERVER_IP:-}}"
# Strip accidental typos like 41.186.86.12.sh
SERVER_HOST="$(echo "$SERVER_HOST" | sed -E 's/\.sh$//' | sed 's/[^a-zA-Z0-9._-]//g')"
production_load_env

if [[ -z "$SERVER_HOST" && -n "${PUBLIC_BASE_URL:-}" ]]; then
  SERVER_HOST="$(echo "$PUBLIC_BASE_URL" | sed -E 's#https?://([^:/]+).*#\1#')"
fi
if [[ -z "$SERVER_HOST" ]]; then
  SERVER_HOST="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
fi

export PUBLIC_PORT="${PUBLIC_PORT:-8003}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${SERVER_HOST}:${PUBLIC_PORT}}"
export SUPERSET_URL="${SUPERSET_URL:-${PUBLIC_BASE_URL%/}/superset/welcome}"
export ENABLE_WAREHOUSE="${ENABLE_WAREHOUSE:-$(production_env_get ENABLE_WAREHOUSE 2>/dev/null || echo false)}"

production_ensure_jwt_secret
production_pick_api_host_port
if [[ "${ENABLE_WAREHOUSE}" == "true" ]]; then
  production_pick_superset_host_port
fi
production_persist_deploy_vars
production_load_env
export ENABLE_WAREHOUSE="${ENABLE_WAREHOUSE:-false}"
export API_HOST_PORT="$(production_sanitize_port "${API_HOST_PORT:-3000}")"
export SUPERSET_HOST_PORT="$(production_sanitize_port "${SUPERSET_HOST_PORT:-8088}")"

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [[ "${ENABLE_WAREHOUSE}" == "true" ]]; then
  COMPOSE_FILES+=(-f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml)
fi

echo "Deploying to ${PUBLIC_BASE_URL}..."
echo "  Warehouse stack: ${ENABLE_WAREHOUSE}"
echo "  API host port:   ${API_HOST_PORT} (nginx must proxy to 127.0.0.1:${API_HOST_PORT})"
if [[ "${ENABLE_WAREHOUSE}" == "true" ]]; then
  echo "  Superset port:   ${SUPERSET_HOST_PORT} (nginx /superset/ → 127.0.0.1:${SUPERSET_HOST_PORT})"
fi

# Do not fail deploy if a prior sudo run left root-owned scripts
if command -v npm >/dev/null 2>&1 && [[ -f scripts/build-frontend.sh ]]; then
  bash scripts/build-frontend.sh
else
  echo "npm not found — Docker will build the Vue frontend during image build"
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found in PATH"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Error: docker compose not available"
  exit 1
fi

docker compose "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

echo ""
echo "Waiting for API health..."
for i in $(seq 1 30); do
  if curl -sf "http://127.0.0.1:${API_HOST_PORT}/api/health" 2>/dev/null | grep -q '"status":"ok"'; then
    echo "API is healthy on http://127.0.0.1:${API_HOST_PORT}"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo ""
    echo "ERROR: API is not responding on port ${API_HOST_PORT} (nginx will show 502)."
    echo ""
    docker compose "${COMPOSE_FILES[@]}" ps -a 2>/dev/null || true
    echo ""
    docker compose "${COMPOSE_FILES[@]}" logs api --tail 60 2>/dev/null || true
    echo ""
    echo "  ss -tlnp | grep ${API_HOST_PORT}"
    exit 1
  fi
  sleep 2
done

echo ""
echo "Deploy complete: ${PUBLIC_BASE_URL}"
echo "  Home:         ${PUBLIC_BASE_URL}/"
echo "  Management:   ${PUBLIC_BASE_URL}/management"
echo "  Registration: ${PUBLIC_BASE_URL}/registration"
echo "  Superset:     ${SUPERSET_URL}/"
echo "  Health:       ${PUBLIC_BASE_URL}/api/health"
echo ""
echo "JWT_SECRET is stored in $(production_env_file) — back up this file."
if [[ "${API_HOST_PORT}" != "3000" || "${SUPERSET_HOST_PORT}" != "8088" ]]; then
  echo ""
  echo "Host ports differ from defaults — refresh nginx:"
  echo "  sudo ./scripts/setup-nginx.sh"
fi
