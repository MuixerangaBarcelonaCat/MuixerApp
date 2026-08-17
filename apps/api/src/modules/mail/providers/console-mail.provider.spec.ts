import { Logger } from '@nestjs/common';
import { ConsoleMailProvider } from './console-mail.provider';

describe('ConsoleMailProvider', () => {
  it('logs the message instead of sending it and resolves', async () => {
    const logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const provider = new ConsoleMailProvider();

    await expect(
      provider.send({
        to: 'membre@example.com',
        subject: 'Recuperació de contrasenya',
        html: '<p>Token: abc123</p>',
        text: 'Token: abc123',
      }),
    ).resolves.toBeUndefined();

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('membre@example.com'),
    );
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('Recuperació de contrasenya'),
    );
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('abc123'));

    logSpy.mockRestore();
  });
});
