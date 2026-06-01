#!/bin/bash

# Script per ACTUALITZAR PRE (desplegaments posteriors)
# Ús: ssh root@204.168.221.131, cd MuixerApp, ./scripts/deploy-pre-update.sh

set -e

echo "🔄 Actualitzant MuixerApp PRE"
echo "============================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Variables (pots canviar-les segons necessitat)
BRANCH="${1:-story/deploy-server-pre}"

echo -e "${YELLOW}📦 Actualitzant codi des de la branca: ${BRANCH}${NC}"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo -e "${GREEN}✅ Codi actualitzat${NC}"
echo ""

echo -e "${YELLOW}🐳 Reconstruint i reiniciant contenidors...${NC}"
docker compose -f docker-compose.pre.yml up -d --build

echo ""
echo -e "${YELLOW}⏳ Esperant que els healthchecks es completin...${NC}"
sleep 10

# Verificar estat
docker compose -f docker-compose.pre.yml ps

echo ""
echo -e "${GREEN}✅ Actualització completada!${NC}"
echo ""
echo "📋 Verifica els logs si cal:"
echo "   docker compose -f docker-compose.pre.yml logs -f api"
echo ""
