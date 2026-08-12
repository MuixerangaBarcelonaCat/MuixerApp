import { Injectable, Logger } from '@nestjs/common';
import { MailMessage, MailProvider } from '../mail-provider.interface';

/**
 * Dev-safe default: logs the message instead of sending it, so the app never
 * needs real mail credentials to run locally. Mirrors the invite-email stub
 * this replaces (see docs/DEBT.md B5).
 */
@Injectable()
export class ConsoleMailProvider implements MailProvider {
  private readonly logger = new Logger(ConsoleMailProvider.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.log(
      `[MAIL:console] to=${message.to} subject="${message.subject}"\n${message.text}`,
    );
  }
}
