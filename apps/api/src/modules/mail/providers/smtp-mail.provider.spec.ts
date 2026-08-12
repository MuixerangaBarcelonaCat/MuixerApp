import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { SmtpMailProvider } from './smtp-mail.provider';

jest.mock('nodemailer');

describe('SmtpMailProvider', () => {
  const sendMail = jest.fn();
  const createTransport = nodemailer.createTransport as jest.Mock;

  const configValues: Record<string, string | number | boolean> = {
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'no-reply@domini.cat',
    SMTP_PASS: 'app-password',
    MAIL_FROM_ADDRESS: 'no-reply@domini.cat',
    MAIL_FROM_NAME: 'MuixerApp',
  };

  const configService = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  beforeEach(() => {
    jest.clearAllMocks();
    createTransport.mockReturnValue({ sendMail });
  });

  it('creates a nodemailer transport from SMTP_* config', () => {
    new SmtpMailProvider(configService);

    expect(createTransport).toHaveBeenCalledWith({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      auth: { user: 'no-reply@domini.cat', pass: 'app-password' },
    });
  });

  it('sends the message via the transport with a composed From header', async () => {
    sendMail.mockResolvedValue(undefined);
    const provider = new SmtpMailProvider(configService);

    await provider.send({
      to: 'membre@example.com',
      subject: 'Recuperació de contrasenya',
      html: '<p>hola</p>',
      text: 'hola',
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'MuixerApp <no-reply@domini.cat>',
      to: 'membre@example.com',
      subject: 'Recuperació de contrasenya',
      html: '<p>hola</p>',
      text: 'hola',
    });
  });

  it('propagates transport failures to the caller', async () => {
    sendMail.mockRejectedValue(new Error('SMTP connection refused'));
    const provider = new SmtpMailProvider(configService);

    await expect(
      provider.send({ to: 'membre@example.com', subject: 's', html: 'h', text: 't' }),
    ).rejects.toThrow('SMTP connection refused');
  });
});
