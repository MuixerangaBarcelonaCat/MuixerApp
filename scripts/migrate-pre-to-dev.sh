#!/usr/bin/env bash
# ============================================================
# Migra tota la BBDD de PRE cap al DEV local (Docker)
#
# Requereix el túnel SSH ja obert: ./scripts/tunnel-pre.sh -b
#
# Ús:
#   ./scripts/migrate-pre-to-dev.sh
#   → demana el password de PRE de forma interactiva (no s'escriu enlloc)
# ============================================================
set -euo pipefail

TUNNEL_PORT="5434"
PRE_USER="muixer_pre"
PRE_DB="muixer_pre"

DEV_CONTAINER="muixer-postgres-dev"
DEV_USER="muixer"
DEV_DB="muixer_dev"
DEV_PASS="muixer_dev_pass"

DUMP_PATH="/tmp/pre.dump"

if ! lsof -iTCP:"${TUNNEL_PORT}" -sTCP:LISTEN -P >/dev/null 2>&1; then
  echo "✗ Túnel no actiu al port ${TUNNEL_PORT}."
  echo "  Obre'l primer: ./scripts/tunnel-pre.sh -b"
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "${DEV_CONTAINER}"; then
  echo "✗ Container ${DEV_CONTAINER} no actiu. Arrenca'l amb: pnpm run docker:up"
  exit 1
fi

read -rsp "Password de PRE (POSTGRES_PASSWORD de ${PRE_USER}): " PRE_PASS
echo ""

echo ""
echo "⚠️  Açò esborrarà TOTES les dades actuals de ${DEV_DB} (local) i les"
echo "   substituirà per les de PRE (${PRE_DB})."
read -rp "Continuar? (s/N): " CONFIRM
if [[ "${CONFIRM}" != "s" && "${CONFIRM}" != "S" ]]; then
  echo "Cancel·lat."
  exit 0
fi

echo "→ Fent dump de PRE..."
docker exec -e PGPASSWORD="${PRE_PASS}" "${DEV_CONTAINER}" \
  pg_dump -h host.docker.internal -p "${TUNNEL_PORT}" -U "${PRE_USER}" -d "${PRE_DB}" \
  -Fc -f "${DUMP_PATH}"

echo "→ Buidant schema de ${DEV_DB} (local)..."
docker exec -e PGPASSWORD="${DEV_PASS}" "${DEV_CONTAINER}" \
  psql -h localhost -p 5432 -U "${DEV_USER}" -d "${DEV_DB}" \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

echo "→ Restaurant dump a ${DEV_DB} (local)..."
docker exec -e PGPASSWORD="${DEV_PASS}" "${DEV_CONTAINER}" \
  pg_restore -h localhost -p 5432 -U "${DEV_USER}" -d "${DEV_DB}" \
  --no-owner --no-privileges "${DUMP_PATH}"

echo "→ Netejant dump temporal..."
docker exec "${DEV_CONTAINER}" rm -f "${DUMP_PATH}"

echo ""
echo "✓ Migració completada."
docker exec -e PGPASSWORD="${DEV_PASS}" "${DEV_CONTAINER}" \
  psql -h localhost -p 5432 -U "${DEV_USER}" -d "${DEV_DB}" \
  -c "select 'persons',count(*) from persons union all select 'events',count(*) from events union all select 'users',count(*) from users;"

echo ""
echo "Recorda tancar el túnel: ./scripts/tunnel-pre.sh --kill"
