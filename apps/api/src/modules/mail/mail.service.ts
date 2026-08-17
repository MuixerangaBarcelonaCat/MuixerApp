import { Inject, Injectable, Logger } from '@nestjs/common';
import { MAIL_PROVIDER, MailMessage, MailProvider } from './mail-provider.interface';

/**
 * Public API used by other modules. Depends only on the MailProvider
 * interface — never on a concrete provider or vendor SDK — so swapping the
 * underlying provider (SMTP, SES, Resend...) never touches call sites.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  constructor(@Inject(MAIL_PROVIDER) private readonly provider: MailProvider) {}

  async send(message: MailMessage): Promise<void> {
    try {
      await this.provider.send(message);
    } catch (err) {
      this.logger.error(`Failed to send email to ${message.to}`, err instanceof Error ? err.stack : err);
      throw new Error('Failed to send email');
    }
  }
}
