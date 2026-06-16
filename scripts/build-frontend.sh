#!/usr/bin/env bash
set -euo pipefail

# Build Vue frontend and sync to public/ for local serving or Docker volume mounts.
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR/frontend"

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required to build the frontend."
  exit 1
fi

echo "Building Vue frontend..."
npm install --legacy-peer-deps --prefer-offline 2>/dev/null || npm install --legacy-peer-deps
npm run build

echo "Syncing frontend/dist → public/"
rm -rf "$ROOT_DIR/public/assets" "$ROOT_DIR/public/index.html" "$ROOT_DIR/public/data"
mkdir -p "$ROOT_DIR/public"
cp -R dist/. "$ROOT_DIR/public/"

echo "Frontend ready in public/"
