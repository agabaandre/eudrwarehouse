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
  if [[ -n "${API_HOST_PORT:-}" ]]; then
    production_env_set API_HOST_PORT "${API_HOST_PORT}"
  fi
}

# Pick a free localhost port for Docker → nginx (3000 is often used by Grafana)
production_pick_api_host_port() {
  local port saved="${API_HOST_PORT:-$(production_env_get API_HOST_PORT 2>/dev/null || true)}"

  if [[ -n "$saved" ]] && ! production_port_in_use "$saved"; then
    export API_HOST_PORT="$saved"
    production_env_set API_HOST_PORT "$saved"
    return 0
  fi

  port=""
  for candidate in 3000 3001 3002 3010; do
    if ! production_port_in_use "$candidate"; then
      port="$candidate"
      break
    fi
  done
  port="${port:-3001}"

  if [[ -n "$saved" && "$saved" != "$port" ]]; then
    echo "Port ${saved} is already in use — switching API_HOST_PORT to ${port}"
  elif [[ "$port" != "3000" ]]; then
    echo "Port 3000 is already in use — using API_HOST_PORT=${port}"
  fi

  export API_HOST_PORT="$port"
  production_env_set API_HOST_PORT "$port"
}

production_port_in_use() {
  local port="$1"
  if command -v ss >/dev/null 2>&1; then
    ss -tln 2>/dev/null | grep -qE ":${port}[[:space:]]"
    return $?
  fi
  if command -v netstat >/dev/null 2>&1; then
    netstat -tln 2>/dev/null | grep -qE ":${port}[[:space:]]"
    return $?
  fi
  return 1
}

production_require_bash() {
  if [[ -z "${BASH_VERSION:-}" ]]; then
    echo "Error: run with bash: ./scripts/deploy.sh"
    exit 1
  fi
}

production_warn_root() {
  if [[ "$(id -u)" -eq 0 ]]; then
    echo "Warning: avoid sudo for deploy — run as your normal user (docker group)."
    echo "  sudo usermod -aG docker \$USER && newgrp docker"
  elif [[ ! -w "${ROOT_DIR}/scripts" ]]; then
    echo "Warning: repo files may be owned by root from a prior sudo deploy."
    echo "  Fix: sudo chown -R \$(whoami):\$(whoami) ${ROOT_DIR}"
  fi
}
