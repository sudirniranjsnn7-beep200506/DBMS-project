#!/usr/bin/env bash
# ==============================================================================
# AssetVault: Restore Verification & Table Row Count Comparison (Bash / Linux)
# Course: BCSE307L Database Systems (Fall 2026-27)
# Restores into scratch DB and compares row counts across all user tables
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
RESTORE_SCRIPT="${SCRIPT_DIR}/restore.sh"

DUMP_FILE=""
KEEP_SCRATCH=false
DOCKER_MODE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-scratch)
      KEEP_SCRATCH=true
      shift
      ;;
    --docker)
      DOCKER_MODE=true
      shift
      ;;
    *)
      if [[ -z "${DUMP_FILE}" ]]; then
        DUMP_FILE="$1"
      fi
      shift
      ;;
  esac
done

echo "================================================================================"
echo " AssetVault: Database Restore Verification Drill"
echo "================================================================================"

# 1. Restore into scratch DB
echo "[STEP 1/3] Restoring backup archive into scratch database 'assetvault_restore_test'..."
RESTORE_CMD=("${RESTORE_SCRIPT}" "--scratch" "-y")
if [[ -n "${DUMP_FILE}" ]]; then
  RESTORE_CMD+=("${DUMP_FILE}")
fi
if [[ "${DOCKER_MODE}" == "true" ]]; then
  RESTORE_CMD+=("--docker")
fi

"${RESTORE_CMD[@]}"

# 2. Load connection details
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

CONN_URL="${MIGRATE_DATABASE_URL:-${DIRECT_URL:-${DATABASE_URL:-}}}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-${POSTGRES_USER:-postgres}}"
DB_PASS="${PGPASSWORD:-${POSTGRES_PASSWORD:-}}"
SOURCE_DB="${PGDATABASE:-${POSTGRES_DB:-assetvault_db}}"
SCRATCH_DB="assetvault_restore_test"

if [[ -n "${CONN_URL}" ]]; then
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
  SOURCE_DB="${RAW_DB%%\?*}"
fi

export PGPASSWORD="${DB_PASS}"

run_sql() {
  local target_db="$1"
  local sql="$2"
  if [[ "${DOCKER_MODE}" == "true" ]]; then
    docker compose exec -T db psql -U "${DB_USER}" -d "${target_db}" -t -A -c "${sql}" | tr -d '\r'
  else
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${target_db}" -t -A -c "${sql}" | tr -d '\r'
  fi
}

echo ""
echo "[STEP 2/3] Querying table catalog and calculating row counts..."

TABLE_QUERY="SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name NOT LIKE '_prisma%' ORDER BY table_name;"
TABLES=$(run_sql "${SOURCE_DB}" "${TABLE_QUERY}")

echo ""
echo "================================================================================"
echo " DATABASE RESTORATION VERIFICATION REPORT"
echo " Source Database : ${SOURCE_DB}"
echo " Scratch Database: ${SCRATCH_DB}"
echo "================================================================================"
printf "%-32s %14s %14s %10s\n" "Table Name" "Source Rows" "Scratch Rows" "Status"
printf '%*s\n' 74 '' | tr ' ' '-'

ALL_PASSED=true

while IFS= read -r tbl || [[ -n "${tbl}" ]]; do
  [[ -z "${tbl}" ]] && continue
  COUNT_SQL="SELECT COUNT(*) FROM \"${tbl}\";"
  SRC_COUNT="$(run_sql "${SOURCE_DB}" "${COUNT_SQL}")"
  SCRATCH_COUNT="$(run_sql "${SCRATCH_DB}" "${COUNT_SQL}")"

  STATUS="PASS"
  if [[ "${SRC_COUNT}" != "${SCRATCH_COUNT}" ]]; then
    STATUS="FAIL"
    ALL_PASSED=false
  fi

  printf "%-32s %14s %14s %10s\n" "${tbl}" "${SRC_COUNT}" "${SCRATCH_COUNT}" "${STATUS}"
done <<< "${TABLES}"

printf '%*s\n' 74 '' | tr ' ' '='

if [[ "${ALL_PASSED}" == "true" ]]; then
  echo "[RESULT] PASS: All tables verified with exact row parity."
else
  echo "[RESULT] FAIL: Discrepancy detected between source and scratch databases!"
fi

# 3. Cleanup Scratch Database
if [[ "${KEEP_SCRATCH}" != "true" ]]; then
  echo ""
  echo "[STEP 3/3] Dropping transient scratch database '${SCRATCH_DB}'..."
  if [[ "${DOCKER_MODE}" == "true" ]]; then
    docker compose exec -T db psql -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null
  else
    psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d postgres -c "DROP DATABASE IF EXISTS ${SCRATCH_DB};" > /dev/null
  fi
  echo "[INFO] Scratch database cleaned up."
fi

if [[ "${ALL_PASSED}" != "true" ]]; then
  exit 1
fi
