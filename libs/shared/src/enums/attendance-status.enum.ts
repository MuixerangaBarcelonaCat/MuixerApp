/**
 * Estats d'assistència d'un membre a un event.
 * - PENDENT: sense resposta (estat inicial)
 * - ANIRE: ha confirmat l'assistència
 * - NO_VAIG: ha declinat l'assistència
 * - ASSISTIT: ha assistit (confirmat post-event)
 * - NO_PRESENTAT: va confirmar però no va aparèixer
 */
export enum AttendanceStatus {
  PENDENT = 'PENDENT',
  ANIRE = 'ANIRE',
  NO_VAIG = 'NO_VAIG',
  ASSISTIT = 'ASSISTIT',
  NO_PRESENTAT = 'NO_PRESENTAT',
  // Future (real-time check-in): CHECK_IN (transient state during event)
}
