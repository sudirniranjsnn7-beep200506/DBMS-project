#!/usr/bin/env bash
# ==============================================================================
# AssetVault: Native PostgreSQL Database Backup Script (Bash / Linux / macOS)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Native tools: pg_dump (Custom -Fc & Plain SQL -Fp) + SHA-256 + 7-Day Retention
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
DOCKER_MODE=false
TARGET_DB=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --docker)
      DOCKER_MODE=true
      shift
      ;;
    --target-db)
      TARGET_DB="$2"
      shift 2
      ;;
    --backup-dir)
      BACKUP_DIR="$2"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

mkdir -p "${BACKUP_DIR}"

# 1. Load environment variables from .env if not present
load_env() {
  local env_file="$1"
  if [[ -f "${env_file}" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      line="$(echo "${line}" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
      if [[ -n "${line}" && ! "${line}" =~ ^# && "${line}" =~ = ]]; then
        local key="${line%%=*}"
        local val="${line#*=}"
        val="${val%\"}"
        val="${val#\"}"
        val="${val%\'}"
        val="${val#\'}"
        if [[ -z "${!key:-}" ]]; then
          export "${key}=${val}"
        fi
      fi
    done < "${env_file}"
  fi
}

if [[ -z "${DATABASE_URL:-}" && -z "${DIRECT_URL:-}" ]]; then
  load_env "${PROJECT_ROOT}/.env"
  if [[ -z "${DATABASE_URL:-}" && -z "${DIRECT_URL:-}" ]]; then
    load_env "${PROJECT_ROOT}/backend/.env"
  fi
fi

# 2. Parse connection parameters
CONN_URL="${MIGRATE_DATABASE_URL:-${DIRECT_URL:-${DATABASE_URL:-}}}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-${POSTGRES_USER:-postgres}}"
DB_PASS="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"
DB_NAME="${TARGET_DB:-${PGDATABASE:-${POSTGRES_DB:-assetvault_db}}}"

if [[ -n "${CONN_URL}" && -z "${TARGET_DB}" ]]; then
  PROTO="$(echo "${CONN_URL}" | grep :// | sed -e's,^\(.*://\).*,\1,g')"
  URL_NO_PROTO="${CONN_URL#$PROTO}"
  USER_PASS="$(echo "${URL_NO_PROTO}" | grep @ | cut -d@ -f1 || true)"
  if [[ -n "${USER_PASS}" ]]; then
    DB_USER="${USER_PASS%%:*}"
    DB_PASS="${USER_PASS#*:}"
  fi
  HOST_PORT_DB="$(echo "${URL_NO_PROTO}" | sed -e "s,^.*@,,g")"
  HOST_PORT="${HOST_PORT_DB%%/*}"
  DB_HOST="${HOST_PORT%%:*}"
  if [[ "${HOST_PORT}" =~ : ]]; then
    DB_PORT="${HOST_PORT#*:}"
  fi
  RAW_DB="${HOST_PORT_DB#*/}"
  DB_NAME="${RAW_DB%%\?*}"
fi

export PGPASSWORD="${DB_PASS}"

echo "================================================================================"
echo " AssetVault: Database Backup Engine"
echo " Target Database : ${DB_NAME} @ ${DB_HOST}:${DB_PORT} (User: ${DB_USER})"
echo " Backup Directory: ${BACKUP_DIR}"
echo "================================================================================"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
CUSTOM_DUMP="assetvault_${TIMESTAMP}.dump"
PLAIN_SQL="assetvault_${TIMESTAMP}.sql"
CUSTOM_PATH="${BACKUP_DIR}/${CUSTOM_DUMP}"
PLAIN_PATH="${BACKUP_DIR}/${PLAIN_SQL}"
CHECKSUM_PATH="${BACKUP_DIR}/${CUSTOM_DUMP}.sha256"

# 3. Perform backups
if [[ "${DOCKER_MODE}" == "true" ]]; then
  echo "[1/3] Generating custom format binary dump (-Fc) via Docker..."
  docker compose exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fc > "${CUSTOM_PATH}"

  echo "[2/3] Generating readable plain SQL dump (-Fp) via Docker..."
  docker compose exec -T db pg_dump -U "${DB_USER}" -d "${DB_NAME}" -Fp > "${PLAIN_PATH}"
else
  PG_DUMP_CMD="pg_dump"
  if ! command -v pg_dump &> /dev/null; then
    for cand in /usr/lib/postgresql/*/bin/pg_dump /usr/local/opt/libpq/bin/pg_dump; do
      if [[ -x "${cand}" ]]; then
        PG_DUMP_CMD="${cand}"
        break
      fi
    done
  fi

  echo "[1/3] Generating custom format binary dump (-Fc)..."
  "${PG_DUMP_CMD}" -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fc -f "${CUSTOM_PATH}"

  echo "[2/3] Generating readable plain SQL dump (-Fp)..."
  "${PG_DUMP_CMD}" -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -Fp -f "${PLAIN_PATH}"
fi

# 4. Generate SHA-256 Checksum
echo "[3/3] Generating SHA-256 cryptographic checksum..."
if command -v sha256sum &> /dev/null; then
  (cd "${BACKUP_DIR}" && sha256sum "${CUSTOM_DUMP}" > "${CUSTOM_DUMP}.sha256")
elif command -v shasum &> /dev/null; then
  (cd "${BACKUP_DIR}" && shasum -a 256 "${CUSTOM_DUMP}" > "${CUSTOM_DUMP}.sha256")
else
  echo "[WARN] Neither sha256sum nor shasum found; skipped checksum"
fi

echo ""
echo "[SUCCESS] Backup Generated Successfully:"
echo "  - Custom Binary Dump: ${CUSTOM_PATH}"
echo "  - Plain Text SQL Dump: ${PLAIN_PATH}"
echo "  - Checksum File     : ${CHECKSUM_PATH}"

# 5. Rotate backups: retain only latest 7
echo ""
echo "[INFO] Enforcing 7-Day Backup Retention Policy..."
DUMPS=( $(ls -t "${BACKUP_DIR}"/assetvault_*.dump 2>/dev/null || true) )
COUNT=${#DUMPS[@]}

if [[ ${COUNT} -gt 7 ]]; then
  STALE_DUMPS=( "${DUMPS[@]:7}" )
  for stale in "${STALE_DUMPS[@]}"; do
    base="${stale%.dump}"
    rm -f "${stale}" "${base}.sql" "${stale}.sha256"
    echo "  - Purged expired archive: $(basename "${stale}")"
  done
else
  echo "  - Currently ${COUNT} backup archive(s) stored (Retention limit: 7)."
fi

echo "================================================================================"
echo " Backup Completed Successfully."
echo "================================================================================"
