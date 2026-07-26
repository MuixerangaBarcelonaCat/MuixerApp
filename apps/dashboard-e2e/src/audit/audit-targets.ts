/**
 * Sample entity IDs from the local dev database, used to reach detail routes
 * during the audit. These are dev-only fixtures — if the dev DB is reset, refresh
 * them with the queries in docs/audit (or via `pnpm docker:psql`).
 *
 * Override any of them via env vars without touching the file.
 */
export const TARGETS = {
  templateId: process.env['AUDIT_TEMPLATE_ID'] || '455b4ae5-8305-4162-b12c-ebd51243dfdb', // "Branca"
  personId: process.env['AUDIT_PERSON_ID'] || '1c7394d9-a9d4-44e0-832d-52f1b7ccf33d', // "PERSIANA"
  eventAssaigId: process.env['AUDIT_EVENT_ASSAIG_ID'] || '1a6e53a1-3581-49d7-8842-024c7a84c0a2', // "ASSAIG GENERAL"
  eventActuacioId: process.env['AUDIT_EVENT_ACTUACIO_ID'] || '9ac11557-16b1-4256-add6-bf137aa9f067', // "FESTA MAJOR"
  // A segment that has at least one figure instance (segment workspace + projection).
  workspaceEventId: process.env['AUDIT_WS_EVENT_ID'] || '29b88c09-a57c-4de6-9ce8-894b91610a99',
  workspaceSegmentId: process.env['AUDIT_WS_SEGMENT_ID'] || 'a9ee74e1-f8a3-41f3-ba80-3842a0b4ae7d',
  workspaceInstanceId: process.env['AUDIT_WS_INSTANCE_ID'] || '745764f9-ef52-48ad-b4cc-a4b54abb3c44',
};
