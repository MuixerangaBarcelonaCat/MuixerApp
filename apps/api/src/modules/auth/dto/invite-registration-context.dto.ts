import { InviteRegistrationContext } from '@muixer/shared';

export class InviteRegistrationContextDto implements InviteRegistrationContext {
  email: string | null;
  person: InviteRegistrationContext['person'];
  expiresAt: string;
  legalDocument: InviteRegistrationContext['legalDocument'];
}
