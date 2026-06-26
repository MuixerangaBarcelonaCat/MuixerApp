/**
 * Estats d'assistència d'un membre a un event.
 * - PENDENT: sense resposta (estat inicial)
 * - ANIRE: ha confirmat l'assistència (pre-event) / no ha confirmat l'arribada (durant/post-event)
 * - NO_VAIG: ha declinat l'assistència
 * - ASSISTIT: ha assistit (confirmat via pantalla de confirmació)
 */
export enum AttendanceStatus {
  PENDENT = 'PENDENT',
  ANIRE = 'ANIRE',
  NO_VAIG = 'NO_VAIG',
  ASSISTIT = 'ASSISTIT',
}
