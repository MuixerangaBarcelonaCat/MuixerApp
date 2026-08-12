import { InviteRegistrationContext } from '@muixer/shared';

export class InviteRegistrationContextDto implements InviteRegistrationContext {
  person: InviteRegistrationContext['person'];
  expiresAt: string;
  legalDocument: InviteRegistrationContext['legalDocument'];
}
