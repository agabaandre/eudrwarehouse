#!/usr/bin/env bash
set -euo pipefail

# Reset Doris volumes after a failed warehouse install.
# Usage: ./scripts/reset-doris.sh

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# shellcheck source=lib/production-env.sh
source "${ROOT_DIR}/scripts/lib/production-env.sh"
production_load_env

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.prod.yml -f docker-compose.warehouse.yml -f docker-compose.prod.warehouse.yml)

echo "Stopping warehouse stack..."
docker compose "${COMPOSE_FILES[@]}" stop doris-fe doris-be superset 2>/dev/null || true

echo "Removing Doris volumes (corrupted meta from bad FE_SERVERS config)..."
docker compose "${COMPOSE_FILES[@]}" down doris-fe doris-be 2>/dev/null || true

for vol in doris_fe_data doris_be_data; do
  project="$(basename "$ROOT_DIR" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')"
  # docker compose names volumes: {project}_{volume}
  for name in "${project}_${vol}" "eudr-platform_${vol}" "eudrwarehouse_${vol}"; do
    if docker volume inspect "$name" >/dev/null 2>&1; then
      docker volume rm "$name" && echo "  removed $name"
    fi
  done
done

echo ""
echo "Doris volumes cleared. Redeploy with:"
echo "  export ENABLE_WAREHOUSE=true"
echo "  ./scripts/deploy.sh YOUR_SERVER_IP"
echo ""
echo "On Linux, also run once if BE fails:"
echo "  sudo sysctl -w vm.max_map_count=2000000"
