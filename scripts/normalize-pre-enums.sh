#!/bin/bash
set -e

# One-time script to normalize PostgreSQL enum type names in PRE.
#
# PRE was bootstrapped with TypeORM synchronize:true, which creates enum types
# with table_column_enum naming (e.g. instance_nodes_zone_enum). The migrations
# use canonical names from InitialSchema (e.g. figure_zone_enum).
#
# This script renames all enums to canonical names so future migrations work
# identically in DEV and PRE.
#
# Usage:
#   ssh root@204.168.221.131 "cd MuixerApp && bash scripts/normalize-pre-enums.sh"

CONTAINER="muixer-postgres-pre"
DB_USER="muixer_pre"
DB_NAME="muixer_pre"

run_sql() {
  docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -tAc "$1"
}

get_udt() {
  local table="$1" column="$2"
  run_sql "SELECT udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='$table' AND column_name='$column'"
}

rename_enum() {
  local current="$1" canonical="$2"
  if [ -z "$current" ]; then
    echo "  ⚠️  Could not find current type for $canonical — skipping"
    return
  fi
  if [ "$current" = "$canonical" ]; then
    echo "  ✅ $canonical — already correct"
    return
  fi
  existing=$(run_sql "SELECT 1 FROM pg_type WHERE typname='$canonical'" 2>/dev/null || true)
  if [ "$existing" = "1" ]; then
    echo "  ⚠️  $canonical already exists as a separate type — manual merge needed"
    return
  fi
  echo "  🔄 Renaming $current → $canonical"
  run_sql "ALTER TYPE \"$current\" RENAME TO \"$canonical\";"
}

echo "╔══════════════════════════════════════════════╗"
echo "║  Normalize PRE enum names to canonical      ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

echo "📋 Discovering current enum type names..."
echo ""

# Resolve actual type names from reference columns
ZONE_TYPE=$(get_udt "instance_nodes" "zone")
SHAPE_TYPE=$(get_udt "instance_nodes" "shape")
ROLE_TYPE=$(get_udt "users" "role")
GENDER_TYPE=$(get_udt "persons" "gender")
AVAIL_TYPE=$(get_udt "persons" "availabilityStatus")
ONBOARD_TYPE=$(get_udt "persons" "onboardingStatus")
EVENT_TYPE=$(get_udt "events" "type")
ATTEND_TYPE=$(get_udt "attendances" "status")
CLIENT_TYPE=$(get_udt "refresh_tokens" "client_type")
REF_TYPE=$(get_udt "reference_elements" "type")

echo "  instance_nodes.zone    → $ZONE_TYPE"
echo "  instance_nodes.shape   → $SHAPE_TYPE"
echo "  users.role             → $ROLE_TYPE"
echo "  persons.gender         → $GENDER_TYPE"
echo "  persons.availabilityStatus → $AVAIL_TYPE"
echo "  persons.onboardingStatus   → $ONBOARD_TYPE"
echo "  events.type            → $EVENT_TYPE"
echo "  attendances.status     → $ATTEND_TYPE"
echo "  refresh_tokens.client_type → $CLIENT_TYPE"
echo "  reference_elements.type    → $REF_TYPE"
echo ""

echo "🔧 Renaming to canonical names..."
rename_enum "$ZONE_TYPE" "figure_zone_enum"
rename_enum "$SHAPE_TYPE" "node_shape_enum"
rename_enum "$ROLE_TYPE" "user_role_enum"
rename_enum "$GENDER_TYPE" "gender_enum"
rename_enum "$AVAIL_TYPE" "availability_status_enum"
rename_enum "$ONBOARD_TYPE" "onboarding_status_enum"
rename_enum "$EVENT_TYPE" "event_type_enum"
rename_enum "$ATTEND_TYPE" "attendance_status_enum"
rename_enum "$CLIENT_TYPE" "client_type_enum"
rename_enum "$REF_TYPE" "reference_element_type_enum"

echo ""
echo "🔍 Verifying all enum types match canonical..."
echo ""
run_sql "SELECT typname FROM pg_type WHERE typtype='e' ORDER BY typname;"
echo ""
echo "✅ Done. PRE enums are now aligned with InitialSchema."
echo "   You can now redeploy with: ./scripts/deploy-pre-update.sh"
