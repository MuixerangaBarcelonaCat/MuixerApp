import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { MailMessage, MailProvider } from '../mail-provider.interface';

/**
 * Generic SMTP provider — works with any SMTP host, including Google
 * Workspace (smtp.gmail.com:587 + an app password on a dedicated mailbox).
 */
@Injectable()
export class SmtpMailProvider implements MailProvider {
  private readonly transport: nodemailer.Transporter;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    this.transport = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      secure: this.configService.get<boolean>('SMTP_SECURE'),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
    const fromName = this.configService.get<string>('MAIL_FROM_NAME');
    const fromAddress = this.configService.get<string>('MAIL_FROM_ADDRESS');
    this.from = `${fromName} <${fromAddress}>`;
  }

  async send(message: MailMessage): Promise<void> {
    await this.transport.sendMail({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
