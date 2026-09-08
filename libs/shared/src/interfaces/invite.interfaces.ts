import { Gender } from '../enums/gender.enum';

/** Resposta de POST /users/invite-link. */
export interface InviteLinkResponse {
  inviteUrl: string;
  expiresAt: string;
}

// DESACTIVAT: resposta de POST /users/recovery-link. Enllaç d'un sol ús que deixava a la persona
// triar una contrasenya nova sense passar pel correu — el generava un ADMIN/TECHNICAL i el
// reenviava a mà. Vegeu apps/api/src/modules/user/user.controller.ts i docs/AUTH_FLOW.md §8.1.
// export interface RecoveryLinkResponse {
//   recoveryUrl: string;
//   expiresAt: string;
// }

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
  /**
   * Email que la colla ja té registrat per a aquesta persona, o `null` si encara no en tenim cap.
   * Quan té valor, el formulari el mostra bloquejat i el backend ignora el que arribi al cos.
   */
  email: string | null;
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
