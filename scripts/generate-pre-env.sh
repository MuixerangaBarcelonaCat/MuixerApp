#!/bin/bash

# Script per generar .env.pre amb secrets segurs
# Ús: ./scripts/generate-pre-env.sh

set -e

echo "🔐 Generant fitxer .env.pre amb secrets segurs..."

# Generar secrets
POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d "=+/" | cut -c1-32)
JWT_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
JWT_REFRESH_SECRET=$(openssl rand -base64 48 | tr -d "=+/" | cut -c1-64)
SETUP_TOKEN=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)

# Copiar .env.pre.example a .env.pre si no existeix
if [ ! -f .env.pre ]; then
  cp .env.pre.example .env.pre
  echo "✅ Creat .env.pre des de .env.pre.example"
else
  echo "⚠️  .env.pre ja existeix. No es sobreescriurà."
  read -p "Vols regenerar els secrets igualment? (s/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Cancel·lat."
    exit 0
  fi
fi

# Substituir placeholders
sed -i.bak "s|<GENERAR_AMB_SCRIPT>|${POSTGRES_PASSWORD}|" .env.pre
sed -i.bak "s|<POSTGRES_PASSWORD>|${POSTGRES_PASSWORD}|g" .env.pre
sed -i.bak "s|JWT_SECRET=<GENERAR_AMB_SCRIPT>|JWT_SECRET=${JWT_SECRET}|" .env.pre
sed -i.bak "s|JWT_REFRESH_SECRET=<GENERAR_AMB_SCRIPT>|JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}|" .env.pre
sed -i.bak "s|SETUP_TOKEN=<GENERAR_AMB_SCRIPT>|SETUP_TOKEN=${SETUP_TOKEN}|" .env.pre

# Eliminar backup
rm -f .env.pre.bak

echo ""
echo "✅ Fitxer .env.pre generat correctament!"
echo ""
echo "📋 Secrets generats:"
echo "   POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}"
echo "   JWT_SECRET: ${JWT_SECRET}"
echo "   JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}"
echo "   SETUP_TOKEN: ${SETUP_TOKEN}"
echo ""
echo "⚠️  IMPORTANT:"
echo "   1. Edita .env.pre i afegeix LEGACY_API_USERNAME i LEGACY_API_PASSWORD"
echo "   2. Guarda aquests secrets en un gestor de contrasenyes"
echo "   3. Elimina SETUP_TOKEN del .env.pre després de crear el primer admin"
echo ""
