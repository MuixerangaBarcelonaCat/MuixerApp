#!/bin/bash

# Script per al PRIMER DESPLEGAMENT a PRE
# Ús: ssh root@204.168.221.131, després executar aquest script al servidor

set -e

echo "🚀 Primer desplegament de MuixerApp a PRE"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Variables
REPO_URL="git@github.com:MuixerangaBarcelonaCat/MuixerApp.git"
BRANCH="merge/pinyes-cordons-i-rengles"
PROJECT_DIR="$HOME/MuixerApp"

# Verificar prerequisites
echo -e "${YELLOW}📋 Verificant prerequisites...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker no està instal·lat${NC}"
  exit 1
fi

if ! command -v git &> /dev/null; then
  echo -e "${RED}❌ Git no està instal·lat${NC}"
  exit 1
fi

if [ "$(id -u)" -ne 0 ] && ! groups $USER | grep -q docker; then
  echo -e "${RED}❌ L'usuari no està al grup docker${NC}"
  echo "   Executa: sudo usermod -aG docker \$USER && newgrp docker"
  exit 1
fi

echo -e "${GREEN}✅ Prerequisites OK${NC}"
echo ""

# Clonar el repositori si no existeix
if [ ! -d "$PROJECT_DIR" ]; then
  echo -e "${YELLOW}📦 Clonant el repositori...${NC}"
  git clone "$REPO_URL" "$PROJECT_DIR"
  echo -e "${GREEN}✅ Repositori clonat${NC}"
else
  echo -e "${YELLOW}📦 El repositori ja existeix, fent pull...${NC}"
  cd "$PROJECT_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
  echo -e "${GREEN}✅ Codi actualitzat${NC}"
fi

cd "$PROJECT_DIR"

# Verificar que .env.pre existeix
if [ ! -f .env.pre ]; then
  echo -e "${RED}❌ No s'ha trobat .env.pre${NC}"
  echo ""
  echo "Genera'l executant localment:"
  echo "  ./scripts/generate-pre-env.sh"
  echo ""
  echo "Després copia'l al servidor:"
  echo "  scp .env.pre root@204.168.221.131:~/MuixerApp/"
  exit 1
fi

echo -e "${GREEN}✅ Fitxer .env.pre trobat${NC}"
echo ""

# Verificar ports lliures
echo -e "${YELLOW}🔍 Verificant ports...${NC}"
PORTS_IN_USE=$(sudo ss -tlnp | grep -E ':80|:443|:3000' || true)
if [ ! -z "$PORTS_IN_USE" ]; then
  echo -e "${RED}⚠️  Alguns ports estan en ús:${NC}"
  echo "$PORTS_IN_USE"
  read -p "Vols continuar igualment? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo -e "${RED}❌ Cancel·lat${NC}"
    exit 0
  fi
fi

echo ""
echo -e "${YELLOW}🐳 Construint i arrencant els contenidors (pot trigar 5-10 min)...${NC}"
docker compose -f docker-compose.pre.yml up -d --build

echo ""
echo -e "${YELLOW}⏳ Esperant que els healthchecks es completin...${NC}"
sleep 10

# Verificar estat dels serveis
echo ""
docker compose -f docker-compose.pre.yml ps

echo ""
echo -e "${GREEN}✅ Contenidors arrencats!${NC}"
echo ""
echo "🔍 Verificant salut de l'API..."

# Esperar fins que l'API respongui (màxim 60s)
RETRIES=12
for i in $(seq 1 $RETRIES); do
  if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ API operativa!${NC}"
    break
  fi
  if [ $i -eq $RETRIES ]; then
    echo -e "${RED}❌ L'API no respon després de 60s${NC}"
    echo "Verifica els logs: docker compose -f docker-compose.pre.yml logs api --tail=50"
    exit 1
  fi
  echo "   Intent $i/$RETRIES..."
  sleep 5
done

echo ""
echo -e "${GREEN}=========================================="
echo "✅ DESPLEGAMENT COMPLETAT!${NC}"
echo "=========================================="
echo ""
echo "📋 Properes passes:"
echo ""
echo "1. Crear el primer usuari administrador:"
echo "   curl -X POST http://204.168.221.131:3000/api/auth/setup/user \\"
echo "     -H \"X-Setup-Token: \$(grep SETUP_TOKEN .env.pre | cut -d'=' -f2)\" \\"
echo "     -H \"Content-Type: application/json\" \\"
echo "     -d '{\"email\": \"admin@muixer.cat\", \"password\": \"contrasenya-forta\"}'"
echo ""
echo "2. ⚠️  ELIMINAR SETUP_TOKEN del .env.pre:"
echo "   nano .env.pre   # Comentar o eliminar la línia SETUP_TOKEN"
echo "   docker compose -f docker-compose.pre.yml restart api"
echo ""
echo "3. Accedir al dashboard:"
echo "   http://204.168.221.131"
echo ""
echo "4. Verificar logs:"
echo "   docker compose -f docker-compose.pre.yml logs -f"
echo ""
