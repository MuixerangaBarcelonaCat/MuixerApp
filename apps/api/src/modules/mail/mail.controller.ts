import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { MailService } from './mail.service';
import { SendTestMailDto } from './dto/send-test-mail.dto';

@ApiTags('mail')
@Controller('mail')
@Roles(UserRole.ADMIN)
export class MailController {
  constructor(private readonly mailService: MailService) {}

  @Get('status')
  @ApiOperation({ summary: 'Comprova si el servei SMTP està configurat' })
  @ApiResponse({ status: 200, description: 'Estat de la configuració SMTP' })
  getStatus(): { configured: boolean } {
    return { configured: this.mailService.isConfigured() };
  }

  @Post('test')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Envia un correu de prova (verifica la connexió SMTP)' })
  @ApiResponse({ status: 204, description: 'Correu enviat correctament' })
  @ApiResponse({ status: 503, description: 'SMTP no configurat o connexió fallida' })
  async sendTest(@Body() dto: SendTestMailDto): Promise<void> {
    if (!this.mailService.isConfigured()) {
      throw new ServiceUnavailableException('SMTP is not configured');
    }

    await this.mailService.sendMail({
      to: dto.to,
      subject: dto.subject ?? 'Prova SMTP — MuixerApp',
      text: dto.message ?? 'Aquest és un correu de prova des de MuixerApp.',
    });
  }

  @Post('verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Verifica la connexió amb el servidor SMTP' })
  @ApiResponse({ status: 204, description: 'Connexió SMTP correcta' })
  @ApiResponse({ status: 503, description: 'SMTP no configurat o connexió fallida' })
  async verifyConnection(): Promise<void> {
    await this.mailService.verifyConnection();
  }
}
