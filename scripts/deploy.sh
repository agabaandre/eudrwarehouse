#!/usr/bin/env bash
set -euo pipefail

# Update and redeploy running containers.
# Usage: ./scripts/deploy.sh [SERVER_IP_OR_HOSTNAME]

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SERVER_HOST="${1:-${SERVER_IP:-}}"
if [[ -z "$SERVER_HOST" && -n "${PUBLIC_BASE_URL:-}" ]]; then
  SERVER_HOST="$(echo "$PUBLIC_BASE_URL" | sed -E 's#https?://([^:/]+).*#\1#')"
fi
if [[ -z "$SERVER_HOST" ]]; then
  SERVER_HOST="$(curl -fsS --max-time 3 https://api.ipify.org 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}' || echo 'localhost')"
fi

export PUBLIC_BASE_URL="${PUBLIC_BASE_URL:-http://${SERVER_HOST}:3000}"

if [[ -z "${JWT_SECRET:-}" ]]; then
  echo "Warning: JWT_SECRET is not set. Existing tokens may break if the API container is recreated."
fi

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml)
if [[ "${ENABLE_WAREHOUSE:-false}" == "true" ]]; then
  COMPOSE_FILES+=(-f docker-compose.warehouse.yml)
fi

echo "Deploying to ${PUBLIC_BASE_URL}..."

docker compose "${COMPOSE_FILES[@]}" up -d --build --remove-orphans

echo "Deploy complete: ${PUBLIC_BASE_URL}/api/health"
