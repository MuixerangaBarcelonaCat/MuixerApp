import { AttendanceStatus } from '../../enums/attendance-status.enum';

/** Resposta de GET /me/events/:eventId/attendance-stats (TECHNICAL/ADMIN): desglossament d'assistència per estat, adults vs xicalla. */
export interface EventAttendanceStats {
  byStatus: Record<AttendanceStatus, { adults: number; xicalla: number }>;
  /** Persones confirmades a venir: ANIRE (+ ASSISTIT si és un assaig ja iniciat/passat llista). */
  coming: { adults: number; xicalla: number };
}
