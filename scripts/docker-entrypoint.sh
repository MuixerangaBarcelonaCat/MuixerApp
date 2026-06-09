#!/bin/sh
set -e

echo "[migrations] Running pending migrations..."
node ./node_modules/typeorm/cli.js migration:run -d ./data-source.js
echo "[migrations] Done."

echo "[entrypoint] Starting API..."
exec node main.js
