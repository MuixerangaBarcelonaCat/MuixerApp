#!/bin/bash
set -e

# One-time script to mark the InitialSchema migration as already applied in PRE.
# PRE was bootstrapped with synchronize:true, so the schema already exists.
# This script inserts a record into the typeorm_migrations table so that
# the migration runner skips InitialSchema on subsequent deploys.
#
# Usage (from the server):
#   bash scripts/baseline-pre-migrations.sh
#
# Or remotely:
#   ssh root@204.168.221.131 "cd MuixerApp && bash scripts/baseline-pre-migrations.sh"

CONTAINER="muixer-postgres-pre"
DB_USER="muixer_pre"
DB_NAME="muixer_pre"

echo "[baseline] Creating typeorm_migrations table and inserting baseline record..."

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  CREATE TABLE IF NOT EXISTS typeorm_migrations (
    id SERIAL PRIMARY KEY,
    timestamp bigint NOT NULL,
    name character varying NOT NULL
  );
"

docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c "
  INSERT INTO typeorm_migrations (timestamp, name)
  SELECT 1748600000000, 'InitialSchema1748600000000'
  WHERE NOT EXISTS (
    SELECT 1 FROM typeorm_migrations WHERE name = 'InitialSchema1748600000000'
  );
"

echo "[baseline] Done. InitialSchema marked as applied in PRE."
echo "[baseline] You can now deploy with the migration entrypoint — it will skip InitialSchema."
