import { Gender } from '../../enums/gender.enum';
import { PersonRegistrationData } from '../invite.interfaces';

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

/** Cos de POST /me/pending-dependents. La xicalla no té telèfon: no s'envia mai. */
export interface DependentRegistrationRequest extends Omit<PersonRegistrationData, 'phone'> {
  personId: string;
}
