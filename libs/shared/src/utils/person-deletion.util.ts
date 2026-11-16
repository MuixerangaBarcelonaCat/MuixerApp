/** What still references a person and so prevents deleting it for good (`GET /persons/:id/deletion-check`). */
export interface PersonDeletionBlockers {
  /** Placements on figure nodes (`node_assignments`). */
  assignments: number;
  /** Attendance rows of any status (`attendances`); no row means PENDENT. */
  attendances: number;
  /** A user account points at this person (`users.person_id`). */
  hasUser: boolean;
  /** Persons whose `mentor` is this person. */
  menteeCount: number;
}

export interface PersonDeletionCheck {
  canDelete: boolean;
  blockers: PersonDeletionBlockers;
}

/** One sentence per blocker, in display order; empty when the person can be deleted. */
export function personDeletionBlockerReasons(b: PersonDeletionBlockers): string[] {
  const reasons: string[] = [];
  if (b.attendances > 0) {
    reasons.push(`Té ${b.attendances} ${b.attendances === 1 ? 'registre' : 'registres'} d'assistència.`);
  }
  if (b.assignments > 0) {
    reasons.push(`Té ${b.assignments} ${b.assignments === 1 ? 'assignació' : 'assignacions'} a figures.`);
  }
  if (b.hasUser) reasons.push("Té un compte d'usuari vinculat.");
  if (b.menteeCount > 0) {
    reasons.push(b.menteeCount === 1 ? "És mentora d'una persona." : `És mentora de ${b.menteeCount} persones.`);
  }
  return reasons;
}
