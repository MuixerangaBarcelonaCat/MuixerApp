/** Persona activa sense camisa, amb el que porta per a rebre-la (`GET /persons/shirt-candidates`). */
export interface ShirtCandidate {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
  isXicalla: boolean;
  joinDate: string | null;
  performancesAttended: number;
  rehearsalsAttended: number;
  /** Data (`YYYY-MM-DD`) del darrer esdeveniment comptat amb assistència marcada; `null` si no n'hi ha cap. */
  lastAttendedDate: string | null;
  isEligible: boolean;
  missingTotal: number;
}
