import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { safeCompare } from '../../common/utils/timing-safe-equal.util';
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
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { SetupUserDto } from './dto/setup-user.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { Public } from './decorators/public.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { TokenService } from './token.service';
import { JWT_REFRESH_TTL_DASHBOARD, JWT_REFRESH_TTL_PWA } from './constants/auth.constants';

/** LocalStrategy attaches the validated User entity to `req.user`. */
interface RequestWithUser extends Request {
  user: User;
}

@ApiTags('auth')
@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService,
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
      secure:
        this.configService.get<string>('COOKIE_SECURE') !== 'false' &&
        this.configService.get<string>('NODE_ENV') === 'production',
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
    @Req() req: RequestWithUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, refreshToken } = await this.authService.login(req.user, dto.clientType);
    this.setRefreshCookie(res, refreshToken, dto.clientType);
    return response;
  }

  /** Rota el refresh token de la cookie httpOnly i retorna un nou access token. Si el token és invàlid o caducat retorna 401. */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Renovar el token d\'accés via cookie de refresh' })
  @ApiResponse({ status: 200, description: 'Nou accessToken generat correctament.' })
  @ApiResponse({ status: 401, description: 'No hi ha refresh token o és invàlid/caducat.' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const rawToken = (req.cookies as Record<string, string>)[this.tokenService.cookieName];
    if (!rawToken) throw new UnauthorizedException('No refresh token');

    const { response, newRefreshToken, clientType } = await this.authService.refresh(rawToken);

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

  /** Crea el primer usuari ADMIN del sistema. Requereix la capçalera `X-Setup-Token`. Bootstrap d'un sol ús: es refusa si ja existeix qualsevol usuari. */
  @Public()
  @Post('setup/user')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear el primer usuari ADMIN del sistema (bootstrap d\'un sol ús)' })
  @ApiHeader({ name: 'x-setup-token', description: 'Token de bootstrap (variable SETUP_TOKEN del .env)', required: true })
  @ApiResponse({ status: 201, description: 'Usuari ADMIN creat correctament.' })
  @ApiResponse({ status: 403, description: 'SETUP_TOKEN no configurat, token incorrecte, o el sistema ja té usuaris.' })
  async setupUser(
    @Headers('x-setup-token') setupToken: string,
    @Body() dto: SetupUserDto,
  ): Promise<UserProfile> {
    const expected = this.configService.get<string>('SETUP_TOKEN');
    if (!expected) {
      this.logger.warn(`Setup rebutjat: SETUP_TOKEN no configurat (email=${dto.email})`);
      throw new ForbiddenException('Setup no disponible');
    }
    if (!safeCompare(setupToken ?? '', expected)) {
      this.logger.warn(`Setup rebutjat: token invàlid (email=${dto.email})`);
      throw new ForbiddenException('Token de configuració invàlid');
    }
    this.logger.log(`Setup endpoint invocat (email=${dto.email})`);
    return this.authService.setupUser(dto);
  }

  /** Envia un correu de recuperació de contrasenya si l'email correspon a un compte actiu. Sempre retorna el mateix missatge genèric, existeixi o no l'email (evita enumeració de comptes). */
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sol·licitar la recuperació de contrasenya per correu electrònic' })
  @ApiResponse({ status: 200, description: 'Missatge genèric — no indica si l\'email existeix.' })
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<{ message: string }> {
    await this.authService.requestPasswordReset(dto.email);
    return { message: 'Si l\'adreça existeix, rebreu un correu amb instruccions per a recuperar la contrasenya.' };
  }

  /** Estableix una nova contrasenya a partir d'un token de recuperació vàlid. Revoca totes les sessions actives de l'usuari. */
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Establir una nova contrasenya a partir d\'un token de recuperació' })
  @ApiResponse({ status: 200, description: 'Contrasenya actualitzada correctament.' })
  @ApiResponse({ status: 401, description: 'Token de recuperació invàlid o caducat.' })
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.authService.resetPassword(dto);
  }
}
