#!/bin/bash
set -e

echo "Initializing Apache Superset..."

superset db upgrade

superset fab create-admin \
  --username "${SUPERSET_ADMIN_USER:-admin}" \
  --firstname Admin \
  --lastname User \
  --email "${SUPERSET_ADMIN_EMAIL:-admin@superset.com}" \
  --password "${SUPERSET_ADMIN_PASSWORD:-admin}" 2>/dev/null || echo "Admin user already exists"

superset init

python /app/setup_connections.py

echo "Starting Superset on port 8088..."
exec gunicorn \
  --bind "0.0.0.0:8088" \
  --workers 2 \
  --worker-class gthread \
  --threads 4 \
  --timeout 120 \
  "superset.app:create_app()"
