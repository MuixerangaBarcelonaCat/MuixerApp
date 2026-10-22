/**
 * Sample entity IDs from the local dev database, used to reach detail routes
 * during the audit. These are dev-only fixtures — if the dev DB is reset, refresh
 * them with the queries in docs/audit (or via `pnpm docker:psql`).
 *
 * Override any of them via env vars without touching the file.
 */
export const TARGETS = {
  templateId: process.env['AUDIT_TEMPLATE_ID'] || '75577101-d486-4f90-acd6-a7b52cd1b0d7', // "Branca"
  personId: process.env['AUDIT_PERSON_ID'] || 'f964b0dd-6396-4ec6-991e-12f99494da66', // "PERSIANA"
  eventAssaigId: process.env['AUDIT_EVENT_ASSAIG_ID'] || '1fee7e98-056b-43f6-afdb-c1d08a728aa8', // "ASSAIG GENERAL"
  eventActuacioId: process.env['AUDIT_EVENT_ACTUACIO_ID'] || 'b5b4ae12-5662-4fb2-8489-2d8babba1d6a', // "DIADA CASTELLERS DE MALLORCA"
  // A segment that has at least one figure instance (segment workspace + projection).
  workspaceEventId: process.env['AUDIT_WS_EVENT_ID'] || '1fee7e98-056b-43f6-afdb-c1d08a728aa8',
  workspaceSegmentId: process.env['AUDIT_WS_SEGMENT_ID'] || 'd3827650-b559-4379-97e4-be8f63ed027e',
  workspaceInstanceId: process.env['AUDIT_WS_INSTANCE_ID'] || 'e7984c7e-03ab-4338-bf43-eaa852809d1f',
};
