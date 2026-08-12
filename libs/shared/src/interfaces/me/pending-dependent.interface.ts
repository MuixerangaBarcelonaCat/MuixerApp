import { Gender } from '../../enums/gender.enum';

/** Prellenat de GET /me/pending-dependents: un dependent (xicalla) encara provisional. */
export interface PendingDependent {
  personId: string;
  alias: string;
  name: string;
  firstSurname: string;
  secondSurname: string | null;
  gender: Gender | null;
  phone: string | null;
  birthDate: string | null;
}
