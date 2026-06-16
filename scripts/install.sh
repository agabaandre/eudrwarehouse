#!/usr/bin/env bash
set -euo pipefail

# First-time installation on a Linux server with Docker.
# Usage: ./scripts/install.sh [SERVER_IP_OR_HOSTNAME]
#
# Example:
#   ./scripts/install.sh 203.0.113.10
#   PUBLIC_BASE_URL=http://203.0.113.10:3000 ./scripts/install.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_HOST="${1:-${SERVER_IP:-}}"
if [[ -z "$SERVER_HOST" ]]; then
  SERVER_HOST="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
fi

export PUBLIC_PORT="${PUBLIC_PORT:-3000}"
export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${SERVER_HOST}:${PUBLIC_PORT}}"
export JWT_SECRET="${JWT_SECRET:-$(openssl rand -hex 32 2>/dev/null || date +%s | shasum | awk '{print $1}')}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install from https://docs.docker.com/engine/install/"
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required."
  exit 1
fi

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [[ "${ENABLE_WAREHOUSE:-false}" == "true" ]]; then
  COMPOSE_FILES+=(-f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml)
fi

echo "Installing MAAIF EUDR Platform..."
echo "  Public URL: ${PUBLIC_BASE_URL}"
echo "  Warehouse stack: ${ENABLE_WAREHOUSE:-false}"

docker compose "${COMPOSE_FILES[@]}" pull --ignore-buildable 2>/dev/null || true
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo ""
echo "Installation complete."
echo "  Platform: ${PUBLIC_BASE_URL}"
echo "  Health:   ${PUBLIC_BASE_URL}/api/health"
if [[ "${ENABLE_WAREHOUSE:-false}" == "true" ]]; then
  SUPERSET_URL="${PUBLIC_BASE_URL%:3000}:8088"
  echo "  Superset: ${SUPERSET_URL}"
fi
echo ""
echo "Save JWT_SECRET for future deploys:"
echo "  export JWT_SECRET=${JWT_SECRET}"
