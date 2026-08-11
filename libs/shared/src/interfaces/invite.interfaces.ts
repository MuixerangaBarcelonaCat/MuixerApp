import { Gender } from '../enums/gender.enum';

/** Resposta de POST /users/invite-link. */
export interface InviteLinkResponse {
  inviteUrl: string;
  expiresAt: string;
}

/** Dades personals compartides entre l'auto-registre i la promoció d'un dependent. */
export interface PersonRegistrationData {
  name: string;
  firstSurname: string;
  secondSurname?: string;
  gender: Gender;
  phone: string;
  birthDate: string;
}

/** Cos de la petició POST /auth/invite/register. */
export interface RegisterViaInviteRequest extends PersonRegistrationData {
  token: string;
  email: string;
  password: string;
  legalAccepted: boolean;
}

/** Resposta de GET /auth/invite/:token. */
export interface InviteRegistrationContext {
  person: {
    name: string;
    firstSurname: string;
    secondSurname: string | null;
    gender: Gender | null;
    phone: string | null;
    birthDate: string | null;
  };
  expiresAt: string;
  legalDocument: {
    content: string;
    version: number;
  };
}
