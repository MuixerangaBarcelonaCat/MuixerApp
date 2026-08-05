import { Controller, Post, HttpCode, HttpStatus, Req } from '@nestjs/common';
import { Request } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtPayload, UserProfile } from '@muixer/shared';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';

/**
 * Consent endpoints. Kept OFF the `/auth/` path on purpose: the frontend auth interceptor strips
 * the Bearer token from every `/auth/` request (to avoid refresh loops), so a consent endpoint
 * under `/auth/` would arrive unauthenticated. This controller lives at `/consent`.
 */
@ApiTags('consent')
@ApiBearerAuth()
@Controller('consent')
export class ConsentController {
  constructor(private readonly authService: AuthService) {}

  /** Registra l'acceptació de la política de privacitat vigent per l'usuari autenticat (click-wrap). */
  @Post('privacy-policy')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acceptar la política de privacitat vigent' })
  @ApiResponse({ status: 200, description: 'Consentiment registrat. Retorna el perfil actualitzat.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  async acceptPrivacyPolicy(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ): Promise<UserProfile> {
    return this.authService.acceptPrivacyPolicy(user.sub, req.ip ?? null);
  }
}
