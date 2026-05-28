-- ========================================================================
-- Reset Figure Data — Versió SAFE (ignora errors si taules no existeixen)
-- ========================================================================
--
-- Aquesta versió usa DROP TABLE ... IF EXISTS CASCADE per netejar tot
-- d'un cop, fins i tot si algunes taules encara no existeixen.
--
-- ATENCIÓ: Això elimina les taules i les torna a crear buides.
-- Només per a entorn de desenvolupament local.
--
-- Ús:
--   pnpm run docker:psql
--   \i scripts/reset-figure-data-safe.sql
-- ========================================================================

BEGIN;

-- Eliminar dades mantenint l'estructura (opció 1 — DELETE)
DO $$
BEGIN
  -- Eliminar assignacions
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'node_assignments') THEN
    DELETE FROM node_assignments;
  END IF;

  -- Eliminar instance nodes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'instance_nodes') THEN
    DELETE FROM instance_nodes;
  END IF;

  -- Eliminar figure instances
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'figure_instances') THEN
    DELETE FROM figure_instances;
  END IF;

  -- Eliminar composition slots
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'composition_slots') THEN
    DELETE FROM composition_slots;
  END IF;

  -- Eliminar composition templates
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'composition_templates') THEN
    DELETE FROM composition_templates;
  END IF;

  -- Eliminar rengles (taula nova F1)
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'rengles') THEN
    DELETE FROM rengles;
  END IF;

  -- Eliminar figure nodes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'figure_nodes') THEN
    DELETE FROM figure_nodes;
  END IF;

  -- Eliminar figure family nodes
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'figure_family_nodes') THEN
    DELETE FROM figure_family_nodes;
  END IF;

  -- Eliminar figure templates
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'figure_templates') THEN
    DELETE FROM figure_templates;
  END IF;

  -- Eliminar figure families
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'figure_families') THEN
    DELETE FROM figure_families;
  END IF;

  RAISE NOTICE 'Neteja completada correctament.';
END $$;

COMMIT;

-- Recompte final (només taules que existeixen)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT table_name
    FROM information_schema.tables
    WHERE table_name IN (
      'node_assignments', 'instance_nodes', 'figure_instances',
      'composition_slots', 'composition_templates', 'rengles',
      'figure_nodes', 'figure_family_nodes', 'figure_templates', 'figure_families'
    )
    AND table_schema = 'public'
  LOOP
    EXECUTE format('SELECT ''%I'' AS table_name, COUNT(*) AS remaining_rows FROM %I', rec.table_name, rec.table_name);
  END LOOP;
END $$;
