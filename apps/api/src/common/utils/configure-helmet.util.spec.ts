import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { configureHelmet } from './configure-helmet.util';

@Controller()
class PingController {
  @Get('ping')
  ping() {
    return { ok: true };
  }
}

describe('configureHelmet', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function startApp(): Promise<string> {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureHelmet(app);
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    return `http://127.0.0.1:${address.port}`;
  }

  it('sets baseline security headers on every response', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/ping`);

    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('x-frame-options')).toBe('SAMEORIGIN');
    expect(response.headers.get('strict-transport-security')).toContain('max-age');
  });
});
