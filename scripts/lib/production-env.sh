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
  local file key value
  file="$(production_env_file)"
  [[ -f "$file" ]] || return 0

  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line// }" ]] && continue
    key="${line%%=*}"
    value="${line#*=}"
    [[ -n "$key" ]] || continue
    # Do not override variables already set in the shell
    if [[ -z "${!key:-}" ]]; then
      export "${key}=${value}"
    fi
  done < "$file"
}

production_persist_deploy_vars() {
  production_env_set PUBLIC_BASE_URL "${PUBLIC_BASE_URL}"
  production_env_set SUPERSET_URL "${SUPERSET_URL}"
  production_env_set ENABLE_WAREHOUSE "${ENABLE_WAREHOUSE:-false}"
  [[ -n "${CLUSTER_WORKERS:-}" ]] && production_env_set CLUSTER_WORKERS "${CLUSTER_WORKERS}"
}
