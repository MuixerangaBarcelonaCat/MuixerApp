export enum AuditAction {
  CONSENT_ACCEPTED = 'CONSENT_ACCEPTED',
  SENSITIVE_DATA_ACCESS = 'SENSITIVE_DATA_ACCESS',
  SENSITIVE_DATA_EXPORT = 'SENSITIVE_DATA_EXPORT',
  ATTENDANCE_LOCK_OVERRIDE = 'ATTENDANCE_LOCK_OVERRIDE',
  // DESACTIVAT amb l'enllaç de recuperació generat per un tècnic (user.controller.ts):
  // «Un ADMIN/TECHNICAL ha generat un enllaç de recuperació per al compte d'una altra persona.»
  // RECOVERY_LINK_CREATED = 'RECOVERY_LINK_CREATED',
  // Reserved for the deferred right-to-be-forgotten work (see docs/DEBT.md SEC5):
  // CONSENT_REVOKED, PERSON_ANONYMIZED
}
