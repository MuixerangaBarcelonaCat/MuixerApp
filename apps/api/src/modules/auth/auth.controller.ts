import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { ClientType, JwtPayload, UserProfile } from '@muixer/shared';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { SetupUserDto } from './dto/setup-user.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { TokenService } from './token.service';
import { JWT_REFRESH_TTL_DASHBOARD, JWT_REFRESH_TTL_PWA } from './constants/auth.constants';

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

  /** Configura la cookie httpOnly del refresh token amb el TTL adequat per al tipus de client. */
  private setRefreshCookie(res: Response, token: string, clientType: ClientType): void {
    const maxAge =
      clientType === ClientType.DASHBOARD ? JWT_REFRESH_TTL_DASHBOARD : JWT_REFRESH_TTL_PWA;
    res.cookie(this.tokenService.cookieName, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: maxAge * 1000,
      secure: process.env['NODE_ENV'] === 'production',
    });
  }

  /** Elimina la cookie del refresh token del navegador (logout). */
  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.tokenService.cookieName, { path: '/api/auth' });
  }

  /** Autentica l'usuari via email+password (LocalStrategy). Retorna accessToken i estableix la cookie httpOnly del refresh token. */
  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Iniciar sessió amb email i contrasenya' })
  @ApiResponse({ status: 200, description: 'Sessió iniciada correctament. Retorna accessToken i perfil d\'usuari.' })
  @ApiResponse({ status: 401, description: 'Credencials incorrectes.' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request & { user: { id: string; email: string; role: string; isActive: boolean; person: unknown } },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, refreshToken } = await this.authService.login(
      req.user as Parameters<typeof this.authService.login>[0],
      dto.clientType,
    );
    this.setRefreshCookie(res, refreshToken, dto.clientType);
    return response;
  }

  /** Rota el refresh token de la cookie httpOnly i retorna un nou access token. Si el token és invàlid o caducat retorna 403. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el token d\'accés via cookie de refresh' })
  @ApiResponse({ status: 200, description: 'Nou accessToken generat correctament.' })
  @ApiResponse({ status: 403, description: 'No hi ha refresh token o és invàlid/caducat.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const rawToken = (req.cookies as Record<string, string>)[this.tokenService.cookieName];
    if (!rawToken) throw new ForbiddenException('No refresh token');

    const { response, newRefreshToken } = await this.authService.refresh(rawToken);

    // Determine clientType from existing cookie to set new cookie TTL correctly
    const clientType = (response.user.role as string) === 'MEMBER'
      ? ClientType.PWA
      : ClientType.DASHBOARD;
    this.setRefreshCookie(res, newRefreshToken, clientType);
    return response;
  }

  /** Revoca el refresh token de la sessió actual i neteja la cookie. Requereix autenticació. */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tancar la sessió actual' })
  @ApiResponse({ status: 200, description: 'Sessió tancada correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = (req.cookies as Record<string, string>)[this.tokenService.cookieName];
    if (rawToken) await this.authService.logout(rawToken);
    this.clearRefreshCookie(res);
  }

  /** Revoca tots els refresh tokens de l'usuari (logout de tots els dispositius). */
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Tancar totes les sessions de l\'usuari (tots els dispositius)' })
  @ApiResponse({ status: 200, description: 'Totes les sessions tancades correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.sub);
    this.clearRefreshCookie(res);
  }

  /** Retorna el perfil de l'usuari autenticat a partir del JWT. */
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Obtenir el perfil de l\'usuari autenticat' })
  @ApiResponse({ status: 200, description: 'Perfil de l\'usuari retornat correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'accés invàlid o expirat.' })
  async getMe(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    return this.authService.getMe(user.sub);
  }

  /** Activa el compte d'un nou membre via token d'invitació i fa auto-login. */
  @Public()
  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acceptar una invitació i activar el compte' })
  @ApiResponse({ status: 200, description: 'Compte activat i sessió iniciada correctament.' })
  @ApiResponse({ status: 401, description: 'Token d\'invitació invàlid o caducat.' })
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, refreshToken } = await this.authService.acceptInvite(dto);
    const clientType = response.user.role === 'MEMBER' ? ClientType.PWA : ClientType.DASHBOARD;
    this.setRefreshCookie(res, refreshToken, clientType);
    return response;
  }

  /** Crea el primer usuari TECHNICAL del sistema. Requereix la capçalera `X-Setup-Token`. Eliminar SETUP_TOKEN del .env en producció. */
  @Public()
  @Post('setup/user')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear el primer usuari TECHNICAL del sistema (bootstrap)' })
  @ApiHeader({ name: 'x-setup-token', description: 'Token de bootstrap (variable SETUP_TOKEN del .env)', required: true })
  @ApiResponse({ status: 201, description: 'Usuari creat o retornat si ja existia (idempotent).' })
  @ApiResponse({ status: 403, description: 'SETUP_TOKEN no configurat o token incorrecte.' })
  async setupUser(
    @Headers('x-setup-token') setupToken: string,
    @Body() dto: SetupUserDto,
  ): Promise<UserProfile> {
    const expected = process.env['SETUP_TOKEN'];
    if (!expected) throw new ForbiddenException('Setup no disponible');
    if (setupToken !== expected) throw new ForbiddenException('Token de configuració invàlid');
    return this.authService.setupUser(dto);
  }
}
