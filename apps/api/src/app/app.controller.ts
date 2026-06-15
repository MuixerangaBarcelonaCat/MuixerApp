import { Controller, Get } from '@nestjs/common';
import { Public } from '../modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  @Get('health')
  @Public()
  healthCheck() {
    return { status: 'ok' };
  }
}
