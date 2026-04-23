import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
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

@Controller('auth')
@Throttle({ default: { limit: 10, ttl: 60000 } })
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
  ) {}

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

  private clearRefreshCookie(res: Response): void {
    res.clearCookie(this.tokenService.cookieName, { path: '/api/auth' });
  }

  @Public()
  @UseGuards(AuthGuard('local'))
  @Post('login')
  @HttpCode(HttpStatus.OK)
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

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
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

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const rawToken = (req.cookies as Record<string, string>)[this.tokenService.cookieName];
    if (rawToken) await this.authService.logout(rawToken);
    this.clearRefreshCookie(res);
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.authService.logoutAll(user.sub);
    this.clearRefreshCookie(res);
  }

  @Get('me')
  async getMe(@CurrentUser() user: JwtPayload): Promise<UserProfile> {
    return this.authService.getMe(user.sub);
  }

  @Public()
  @Post('invite/accept')
  @HttpCode(HttpStatus.OK)
  async acceptInvite(
    @Body() dto: AcceptInviteDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    const { response, refreshToken } = await this.authService.acceptInvite(dto);
    const clientType = response.user.role === 'MEMBER' ? ClientType.PWA : ClientType.DASHBOARD;
    this.setRefreshCookie(res, refreshToken, clientType);
    return response;
  }

  @Public()
  @Post('setup/user')
  @HttpCode(HttpStatus.CREATED)
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
