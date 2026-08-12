export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface MailProvider {
  send(message: MailMessage): Promise<void>;
}

/** DI token — MailService depends on this interface, never on a concrete provider or vendor SDK. */
export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');
