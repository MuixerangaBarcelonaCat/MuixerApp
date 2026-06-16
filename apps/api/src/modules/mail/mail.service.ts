import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import nodemailer, { Transporter } from 'nodemailer';
import {
  getDashboardBaseUrl,
  getPwaBaseUrl,
  getSmtpFrom,
  getSmtpHost,
  getSmtpPass,
  getSmtpPort,
  getSmtpUser,
  isSmtpConfigured,
} from './constants/mail.constants';
import { UserRole } from '@muixer/shared';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Transporter | null = null;

  isConfigured(): boolean {
    return isSmtpConfigured();
  }

  private getTransporter(): Transporter {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }

    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: getSmtpHost(),
        port: getSmtpPort(),
        auth: {
          user: getSmtpUser(),
          pass: getSmtpPass(),
        },
      });
    }

    return this.transporter;
  }

  async sendMail(options: SendMailOptions): Promise<void> {
    if (!this.isConfigured()) {
      this.logger.warn(
        `SMTP not configured — skipping email to ${options.to}: ${options.subject}`,
      );
      return;
    }

    await this.getTransporter().sendMail({
      from: getSmtpFrom(),
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
    });
  }

  async sendInviteEmail(to: string, inviteToken: string): Promise<void> {
    const inviteUrl = `${getPwaBaseUrl()}/accept-invite?token=${inviteToken}`;
    const subject = 'Invitació a MuixerApp';
    const text =
      `Has rebut una invitació per accedir a MuixerApp.\n\n` +
      `Obre aquest enllaç per activar el teu compte:\n${inviteUrl}\n\n` +
      `L'enllaç caduca en 72 hores.`;

    const html =
      `<p>Has rebut una invitació per accedir a <strong>MuixerApp</strong>.</p>` +
      `<p><a href="${inviteUrl}">Activa el teu compte</a></p>` +
      `<p>L'enllaç caduca en 72 hores.</p>`;

    await this.sendMail({ to, subject, text, html });
  }

  private getPasswordResetBaseUrl(role: UserRole): string {
    return role === UserRole.MEMBER ? getPwaBaseUrl() : getDashboardBaseUrl();
  }

  async sendPasswordResetEmail(
    to: string,
    resetToken: string,
    role: UserRole = UserRole.MEMBER,
  ): Promise<void> {
    const resetUrl = `${this.getPasswordResetBaseUrl(role)}/reset-password?token=${resetToken}`;
    const subject = 'Restablir contrasenya — MuixerApp';
    const text =
      `Has sol·licitat restablir la contrasenya del teu compte.\n\n` +
      `Obre aquest enllaç per definir una nova contrasenya:\n${resetUrl}\n\n` +
      `Si no has fet aquesta sol·licitud, pots ignorar aquest correu.`;

    const html =
      `<p>Has sol·licitat restablir la contrasenya del teu compte.</p>` +
      `<p><a href="${resetUrl}">Restablir contrasenya</a></p>` +
      `<p>Si no has fet aquesta sol·licitud, pots ignorar aquest correu.</p>`;

    await this.sendMail({ to, subject, text, html });
  }

  async sendWelcomeEmail(to: string, displayName?: string): Promise<void> {
    const greeting = displayName ? `Hola, ${displayName}` : 'Hola';
    const subject = 'Benvingut/da a MuixerApp';
    const text =
      `${greeting},\n\n` +
      `El teu compte a MuixerApp ja està actiu.\n\n` +
      `Ja pots iniciar sessió amb el teu correu i contrasenya.`;

    const html =
      `<p>${greeting},</p>` +
      `<p>El teu compte a <strong>MuixerApp</strong> ja està actiu.</p>` +
      `<p>Ja pots iniciar sessió amb el teu correu i contrasenya.</p>`;

    await this.sendMail({ to, subject, text, html });
  }

  async verifyConnection(): Promise<void> {
    await this.getTransporter().verify();
  }
}
