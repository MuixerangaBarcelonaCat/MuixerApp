/**
 * Estats d'assistència d'un membre a un event, tal com es desen a la taula `attendances`.
 * - PENDENT: sense resposta. No tindre fila equival a PENDENT; només es desa una fila PENDENT
 *   quan algú havia respost i torna a Pendent (o quan l'equip tècnic hi afig una nota).
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

/**
 * Estat derivat, mai desat: la persona no tenia resposta (cap fila, o una fila PENDENT) i es va
 * donar d'alta després del dia de l'event. Les llistes i recomptes d'un event l'exclouen; només
 * es retorna quan es demana l'assistència d'una persona concreta.
 */
export const NOT_REGISTERED_STATUS = 'NO_REGISTRAT' as const;

/** Estat d'assistència tal com el resol l'API: el desat a la taula, o `NO_REGISTRAT`. */
export type ResolvedAttendanceStatus = AttendanceStatus | typeof NOT_REGISTERED_STATUS;
