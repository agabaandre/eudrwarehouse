# Shared production environment helpers for install.sh and deploy.sh.
# Ensures JWT_SECRET and other vars exist in repo-root .env (gitignored).

production_env_file() {
  echo "${ROOT_DIR}/.env"
}

production_env_get() {
  local key="$1"
  local file
  file="$(production_env_file)"
  [[ -f "$file" ]] || return 1
  grep -m1 "^${key}=" "$file" 2>/dev/null | cut -d= -f2- || return 1
}

production_env_set() {
  local key="$1"
  local value="$2"
  local file
  file="$(production_env_file)"
  touch "$file"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    if [[ "$(uname)" == "Darwin" ]]; then
      sed -i '' "s|^${key}=.*|${key}=${value}|" "$file"
    else
      sed -i "s|^${key}=.*|${key}=${value}|" "$file"
    fi
  else
    echo "${key}=${value}" >> "$file"
  fi
}

production_ensure_jwt_secret() {
  local file existing
  file="$(production_env_file)"
  touch "$file"

  existing="$(production_env_get JWT_SECRET || true)"
  if [[ -n "$existing" ]]; then
    export JWT_SECRET="$existing"
    return 0
  fi

  if [[ -n "${JWT_SECRET:-}" ]]; then
    production_env_set JWT_SECRET "$JWT_SECRET"
    echo "Saved JWT_SECRET to ${file}"
    return 0
  fi

  JWT_SECRET="$(openssl rand -hex 32 2>/dev/null || date +%s | shasum | awk '{print $1}')"
  production_env_set JWT_SECRET "$JWT_SECRET"
  export JWT_SECRET
  echo "Generated JWT_SECRET and saved to ${file}"
  echo "  Keep this file safe — redeploys reuse the same secret."
}

production_load_env() {
  local file line key value current
  file="$(production_env_file)"
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -n "$key" ]] || continue
    # Portable indirect read (works on bash 3.2+; avoids ${!key})
    current=""
    eval "current=\${${key}-}"
    if [[ -z "$current" ]]; then
      export "${key}=${value}"
    fi
  done < "$file"
}

production_persist_deploy_vars() {
  production_env_set PUBLIC_BASE_URL "${PUBLIC_BASE_URL}"
  production_env_set SUPERSET_URL "${SUPERSET_URL}"
  if [[ -n "${ENABLE_WAREHOUSE:-}" ]]; then
    production_env_set ENABLE_WAREHOUSE "${ENABLE_WAREHOUSE}"
  elif ! production_env_get ENABLE_WAREHOUSE >/dev/null 2>&1; then
    production_env_set ENABLE_WAREHOUSE "false"
  fi
  if [[ -n "${CLUSTER_WORKERS:-}" ]]; then
    production_env_set CLUSTER_WORKERS "${CLUSTER_WORKERS}"
  fi
}

production_require_bash() {
  if [[ -z "${BASH_VERSION:-}" ]]; then
    echo "Error: run with bash: ./scripts/deploy.sh"
    exit 1
  fi
}

production_warn_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "Warning: avoid sudo — run as your normal user (must be in the docker group)."
    echo "  sudo usermod -aG docker \$USER && newgrp docker"
  fi
}
