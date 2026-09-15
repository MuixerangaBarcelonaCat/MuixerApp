/** Resposta de GET /me/persons/:personId: resum d'una persona per a la capçalera del perfil. */
export interface PersonProfileSummary {
  personId: string;
  alias: string;
  name: string;
  firstSurname: string;
  delegationCount: number;
  /** Assistència de la temporada actual, comptant només events ja passats. */
  seasonAttendance: {
    assajosAttended: number;
    assajosTotal: number;
    actuacionsAttended: number;
    actuacionsTotal: number;
  };
}
