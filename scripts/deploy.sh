#!/usr/bin/env bash
set -euo pipefail

# Update and redeploy running containers.
# Usage: ./scripts/deploy.sh [SERVER_IP_OR_HOSTNAME]
#
# JWT_SECRET is loaded from .env or auto-generated on first deploy.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"
# shellcheck source=lib/production-env.sh
source "${ROOT_DIR}/scripts/lib/production-env.sh"

SERVER_HOST="${1:-${SERVER_IP:-}}"
production_load_env

if [[ -z "$SERVER_HOST" && -n "${PUBLIC_BASE_URL:-}" ]]; then
  SERVER_HOST="$(echo "$PUBLIC_BASE_URL" | sed -E 's#https?://([^:/]+).*#\1#')"
fi
if [[ -z "$SERVER_HOST" ]]; then
  SERVER_HOST="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
fi

export PUBLIC_PORT="${PUBLIC_PORT:-8003}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${SERVER_HOST}:${PUBLIC_PORT}}"
export SUPERSET_URL="${SUPERSET_URL:-${PUBLIC_BASE_URL%/}/superset}"

production_ensure_jwt_secret
production_persist_deploy_vars
production_load_env

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [[ "${ENABLE_WAREHOUSE:-false}" == "true" ]]; then
  COMPOSE_FILES+=(-f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml)
fi

echo "Deploying to ${PUBLIC_BASE_URL}..."

chmod +x scripts/build-frontend.sh
if command -v npm >/dev/null 2>&1; then
  ./scripts/build-frontend.sh
else
  echo "npm not found — Docker will build the Vue frontend during image build"
fi

docker compose "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

echo ""
echo "Deploy complete: ${PUBLIC_BASE_URL}"
echo "  Home:         ${PUBLIC_BASE_URL}/"
echo "  Management:   ${PUBLIC_BASE_URL}/management"
echo "  Registration: ${PUBLIC_BASE_URL}/registration"
echo "  Superset:     ${SUPERSET_URL}/"
echo "  Health:       ${PUBLIC_BASE_URL}/api/health"
echo ""
echo "JWT_SECRET is stored in $(production_env_file) — back up this file."
