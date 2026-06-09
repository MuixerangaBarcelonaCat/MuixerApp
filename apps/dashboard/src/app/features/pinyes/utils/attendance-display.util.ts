/** Catalan labels for attendance statuses shown in UI badges. */
export const ATTENDANCE_LABELS: Record<string, string> = {
  ANIRE: 'Vinc',
  NO_VAIG: 'No vinc',
  PENDENT: 'Pendent',
  ASSISTIT: 'Assistit/da',
  NO_PRESENTAT: 'No presentat/da',
};

/** DaisyUI badge classes for attendance statuses. */
export const ATTENDANCE_BADGE_CLASSES: Record<string, string> = {
  ANIRE: 'badge-success',
  NO_VAIG: 'badge-error',
  PENDENT: 'badge-warning',
  ASSISTIT: 'badge-success',
  NO_PRESENTAT: 'badge-error',
};

/**
 * Hex colour for Konva canvas dot badges.
 * Intentionally separate from CSS-based `ATTENDANCE_BADGE_CLASSES`.
 */
export const ATTENDANCE_COLORS: Record<string, string> = {
  ANIRE: '#22c55e',
  PENDENT: '#f59e0b',
  NO_VAIG: '#ef4444',
  ASSISTIT: '#22c55e',
  NO_PRESENTAT: '#ef4444',
};

/**
 * oklch CSS colour for SVG/DOM attendance indicators (TroncView).
 * Returns a muted neutral for unknown statuses.
 */
export function getAttendanceCssColor(status: string | null | undefined): string {
  if (status === 'ANIRE' || status === 'ASSISTIT') return 'oklch(var(--su))';
  if (status === 'NO_VAIG' || status === 'NO_PRESENTAT') return 'oklch(var(--er))';
  return 'oklch(var(--bc) / 0.2)';
}

export function getAttendanceBadgeClass(status: string | null | undefined): string {
  return ATTENDANCE_BADGE_CLASSES[status ?? ''] ?? 'badge-ghost';
}

export function getAttendanceLabel(status: string | null | undefined): string {
  return ATTENDANCE_LABELS[status ?? ''] ?? 'Assignat/da';
}
