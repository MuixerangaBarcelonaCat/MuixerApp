import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER } from './mail-provider.interface';
import { MailService } from './mail.service';
import { ConsoleMailProvider } from './providers/console-mail.provider';

/**
 * Picks the concrete MailProvider from MAIL_PROVIDER (default 'console', a
 * dev-safe stub that logs instead of sending). Swapping providers later
 * (e.g. 'smtp') only needs a new case here — MailService and its callers
 * never change.
 */
@Module({
  imports: [ConfigModule],
  providers: [
    MailService,
    {
      provide: MAIL_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const provider = config.get<string>('MAIL_PROVIDER', 'console');
        switch (provider) {
          case 'console':
            return new ConsoleMailProvider();
          default:
            throw new Error(`Unsupported MAIL_PROVIDER: ${provider}`);
        }
      },
    },
  ],
  exports: [MailService],
})
export class MailModule {}
