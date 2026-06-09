-- ========================================================================
-- Reset Figure Data — Neteja completa del mòdul de Pinyes
-- ========================================================================
--
-- Elimina totes les dades relacionades amb figures, templates, rengles,
-- instàncies i assignacions. Respecta l'ordre de dependències (FK).
--
-- NO toca: events, event_segments, seasons, persons, users, attendances
--
-- Ús:
--   psql -h localhost -U muixer -d muixer_dev -f scripts/reset-figure-data.sql
--   o bé:
--   pnpm run docker:psql
--   \i scripts/reset-figure-data.sql
-- ========================================================================

BEGIN;

-- 1. Assignacions (depenen de instance_nodes + figure_instances)
DELETE FROM node_assignments;

-- 2. Instance nodes (depenen de figure_instances)
DELETE FROM instance_nodes;

-- 3. Figure instances (depenen de figure_templates, event_segments, compositions)
DELETE FROM figure_instances;

-- 4. Composition slots (depenen de figure_templates + composition_templates)
DELETE FROM composition_slots;

-- 5. Composition templates
DELETE FROM composition_templates;

-- 6. Rengles (depenen de figure_templates) — taula nova F1
DELETE FROM rengles WHERE true;

-- 7. Figure nodes (depenen de figure_templates)
DELETE FROM figure_nodes;

-- 8. Figure family nodes (depenen de figure_families)
DELETE FROM figure_family_nodes;

-- 9. Figure templates (depenen de figure_families)
DELETE FROM figure_templates;

-- 10. Figure families
DELETE FROM figure_families;

COMMIT;

-- Recompte final
SELECT 'node_assignments' AS table_name, COUNT(*) AS remaining_rows FROM node_assignments
UNION ALL
SELECT 'instance_nodes', COUNT(*) FROM instance_nodes
UNION ALL
SELECT 'figure_instances', COUNT(*) FROM figure_instances
UNION ALL
SELECT 'composition_slots', COUNT(*) FROM composition_slots
UNION ALL
SELECT 'composition_templates', COUNT(*) FROM composition_templates
UNION ALL
SELECT 'rengles', COUNT(*) FROM rengles
UNION ALL
SELECT 'figure_nodes', COUNT(*) FROM figure_nodes
UNION ALL
SELECT 'figure_family_nodes', COUNT(*) FROM figure_family_nodes
UNION ALL
SELECT 'figure_templates', COUNT(*) FROM figure_templates
UNION ALL
SELECT 'figure_families', COUNT(*) FROM figure_families;
