import { Test, TestingModule } from '@nestjs/testing';
import { MailService } from './mail.service';
import { MAIL_PROVIDER, MailMessage } from './mail-provider.interface';

describe('MailService', () => {
  let service: MailService;
  let provider: { send: jest.Mock };

  const message: MailMessage = {
    to: 'membre@example.com',
    subject: 'Recuperació de contrasenya',
    html: '<p>hola</p>',
    text: 'hola',
  };

  beforeEach(async () => {
    provider = { send: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [MailService, { provide: MAIL_PROVIDER, useValue: provider }],
    }).compile();

    service = module.get(MailService);
  });

  it('delegates to the configured provider', async () => {
    provider.send.mockResolvedValue(undefined);

    await service.send(message);

    expect(provider.send).toHaveBeenCalledWith(message);
  });

  it('wraps provider failures in a generic error instead of leaking the provider error', async () => {
    provider.send.mockRejectedValue(new Error('SMTP connection refused'));

    await expect(service.send(message)).rejects.toThrow('Failed to send email');
  });
});
