import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from '../modules/auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getData() {
    return this.appService.getData();
  }
}
