/** Resposta de GET /me/persons/:personId: resum d'una persona per a la capçalera del perfil. */
export interface PersonProfileSummary {
  personId: string;
  alias: string;
  name: string;
  firstSurname: string;
  delegationCount: number;
}
