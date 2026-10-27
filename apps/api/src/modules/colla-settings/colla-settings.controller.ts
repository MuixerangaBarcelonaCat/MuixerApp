import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CollaSettings, JwtPayload, PublicCollaSettings, UserRole } from '@muixer/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CollaSettingsService } from './colla-settings.service';
import { UpdateCollaSettingsDto } from './dto/update-colla-settings.dto';

@ApiTags('colla-settings')
@ApiBearerAuth()
@Controller('colla-settings')
export class CollaSettingsController {
  constructor(private readonly settings: CollaSettingsService) {}

  @Get('public')
  @Public()
  @ApiOperation({ summary: 'Nom de la colla, per a la pantalla d\'inici de sessió' })
  @ApiResponse({ status: 200, description: 'Nom de la colla.' })
  getPublic(): Promise<PublicCollaSettings> {
    return this.settings.getPublic();
  }

  // No @Roles: both apps need the settings (relative heights, tronc warnings, camises).
  @Get()
  @ApiOperation({ summary: 'Configuració de la colla' })
  @ApiResponse({ status: 200, description: 'Configuració de la colla.' })
  get(): Promise<CollaSettings> {
    return this.settings.get();
  }

  @Patch()
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: 'Modificar la configuració de la colla' })
  @ApiResponse({ status: 200, description: 'Configuració actualitzada.' })
  @ApiResponse({ status: 400, description: 'Dades invàlides.' })
  @ApiResponse({ status: 404, description: "No s'ha trobat l'etiqueta per defecte." })
  update(
    @Body() dto: UpdateCollaSettingsDto,
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<CollaSettings> {
    return this.settings.update(dto, { userId: user.sub, ipAddress: req.ip ?? null });
  }
}
