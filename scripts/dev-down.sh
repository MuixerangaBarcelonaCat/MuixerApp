#!/usr/bin/env bash
# Atura API/dashboard/PWA per port (pkill sol deixa els fills escoltant). `--db` també atura Postgres.
cd "$(dirname "$0")/.."
pkill -f 'nx.js serve' 2>/dev/null || true
pids=$(lsof -nP -iTCP:3000,4200,4300 -sTCP:LISTEN -t 2>/dev/null || true)
[ -n "$pids" ] && kill $pids
[ "${1:-}" = "--db" ] && pnpm run docker:down
echo "Aturat"
