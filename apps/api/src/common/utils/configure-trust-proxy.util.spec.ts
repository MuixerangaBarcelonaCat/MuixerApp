import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { configureTrustProxy } from './configure-trust-proxy.util';

@Controller()
class ClientIpController {
  @Get('client-ip')
  getClientIp(@Req() req: Request) {
    return { ip: req.ip };
  }
}

describe('configureTrustProxy', () => {
  let app: INestApplication;

  afterEach(async () => {
    await app?.close();
  });

  async function startApp(): Promise<string> {
    const moduleRef = await Test.createTestingModule({
      controllers: [ClientIpController],
    }).compile();

    app = moduleRef.createNestApplication();
    configureTrustProxy(app);
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    return `http://127.0.0.1:${address.port}`;
  }

  it('resolves req.ip from X-Forwarded-For instead of the socket address', async () => {
    const baseUrl = await startApp();

    const response = await fetch(`${baseUrl}/client-ip`, {
      headers: { 'X-Forwarded-For': '203.0.113.7' },
    });
    const body = await response.json();

    expect(body.ip).toBe('203.0.113.7');
  });
});
