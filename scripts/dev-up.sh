#!/usr/bin/env bash
# Arrenca l'stack local: Postgres (Docker) + API :3000 + dashboard :4200 + PWA :4300.
# Ús: scripts/dev-up.sh [api] [dashboard] [pwa]   (sense arguments = tot)
# Idempotent: salta el que ja escolta. Logs a tmp/dev-logs/.
set -euo pipefail
cd "$(dirname "$0")/.."

LOGS=tmp/dev-logs
mkdir -p "$LOGS"
APPS=("$@"); [ ${#APPS[@]} -eq 0 ] && APPS=(api dashboard pwa)

port_of() { case $1 in api) echo 3000;; dashboard) echo 4200;; pwa) echo 4300;; *) echo "App desconeguda: $1 (api|dashboard|pwa)" >&2; exit 1;; esac; }
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN -t >/dev/null 2>&1; }

[ -f .env ] || { echo "Falta .env: cp .env.example .env" >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Docker no està en marxa" >&2; exit 1; }

if ! docker ps --format '{{.Names}}' | grep -q '^muixer-postgres-dev$'; then
  echo "Postgres: arrencant..."
  pnpm run docker:up >/dev/null
fi

for app in "${APPS[@]}"; do
  port=$(port_of "$app")
  if listening "$port"; then
    echo "$app: ja escolta a :$port (si has canviat codi de l'API, fes dev:down i dev:up)"
    continue
  fi
  # ponytail: --no-watch només per a l'API (el mode watch entra en bucle de reinicis); la resta fa HMR.
  extra=""; [ "$app" = api ] && extra="--no-watch"
  echo "$app: arrencant (log: $LOGS/$app.log)"
  nohup npx nx serve "$app" $extra >"$LOGS/$app.log" 2>&1 &
done

wait_for() { # url, nom
  for _ in $(seq 1 90); do
    [ "$(curl -s -o /dev/null -w '%{http_code}' "$1")" = 200 ] && { echo "$2 OK"; return; }
    sleep 2
  done
  echo "$2: no respon després de 180s, mira $LOGS/" >&2; exit 1
}
for app in "${APPS[@]}"; do
  case $app in
    api) wait_for http://localhost:3000/api/docs "API  http://localhost:3000/api/docs";;
    dashboard) wait_for http://localhost:4200 "Dashboard  http://localhost:4200";;
    pwa) wait_for http://localhost:4300 "PWA  http://localhost:4300";;
  esac
done
