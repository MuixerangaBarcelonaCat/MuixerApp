import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { UserRole } from '@muixer/shared';
import { MailService } from './mail.service';

const sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
const verifyMock = jest.fn().mockResolvedValue(true);

jest.mock('nodemailer', () => ({
  __esModule: true,
  default: {
    createTransport: jest.fn(() => ({
      sendMail: sendMailMock,
      verify: verifyMock,
    })),
  },
}));

describe('MailService', () => {
  let service: MailService;
  const env = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...env };
    service = new MailService();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = env;
  });

  describe('isConfigured', () => {
    it('returns false when SMTP env vars are missing', () => {
      delete process.env['SMTP_HOST'];
      expect(new MailService().isConfigured()).toBe(false);
    });

    it('returns true when host, user and pass are set', () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';
      expect(new MailService().isConfigured()).toBe(true);
    });
  });

  describe('sendMail', () => {
    it('skips sending and logs when SMTP is not configured', async () => {
      delete process.env['SMTP_HOST'];

      await service.sendMail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(sendMailMock).not.toHaveBeenCalled();
    });

    it('sends email when SMTP is configured', async () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';
      process.env['SMTP_FROM'] = 'MuixerApp <noreply@muixer.cat>';

      const configuredService = new MailService();
      await configuredService.sendMail({
        to: 'test@example.com',
        subject: 'Test',
        text: 'Hello',
      });

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'test@example.com',
          subject: 'Test',
          text: 'Hello',
        }),
      );
    });
  });

  describe('sendInviteEmail', () => {
    it('includes accept-invite link with token', async () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';
      process.env['PWA_BASE_URL'] = 'http://localhost:4300';

      const configuredService = new MailService();
      await configuredService.sendInviteEmail('member@example.com', 'abc123');

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'member@example.com',
          subject: 'Invitació a MuixerApp',
          text: expect.stringContaining(
            'http://localhost:4300/accept-invite?token=abc123',
          ),
        }),
      );
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('uses PWA base URL for members', async () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';
      process.env['PWA_BASE_URL'] = 'http://localhost:4300';

      const configuredService = new MailService();
      await configuredService.sendPasswordResetEmail(
        'member@example.com',
        'reset123',
        UserRole.MEMBER,
      );

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'http://localhost:4300/reset-password?token=reset123',
          ),
        }),
      );
    });

    it('uses dashboard base URL for technical users', async () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';
      process.env['DASHBOARD_BASE_URL'] = 'http://localhost:4200';

      const configuredService = new MailService();
      await configuredService.sendPasswordResetEmail(
        'tech@example.com',
        'reset123',
        UserRole.TECHNICAL,
      );

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining(
            'http://localhost:4200/reset-password?token=reset123',
          ),
        }),
      );
    });
  });

  describe('sendWelcomeEmail', () => {
    it('includes personalized greeting when display name is provided', async () => {
      process.env['SMTP_HOST'] = 'smtp.example.com';
      process.env['SMTP_USER'] = 'user';
      process.env['SMTP_PASS'] = 'pass';

      const configuredService = new MailService();
      await configuredService.sendWelcomeEmail('user@example.com', 'Anna');

      expect(sendMailMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: 'Benvingut/da a MuixerApp',
          text: expect.stringContaining('Hola, Anna'),
        }),
      );
    });
  });

  describe('verifyConnection', () => {
    it('throws when SMTP is not configured', async () => {
      delete process.env['SMTP_HOST'];

      await expect(service.verifyConnection()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
