import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientType, UserRole } from '@muixer/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JWT_REFRESH_TTL_DASHBOARD, JWT_REFRESH_TTL_PWA } from './constants/auth.constants';

const mockAuthService = () => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  getMe: jest.fn(),
  registerViaInvite: jest.fn(),
  getInviteContext: jest.fn(),
  setupUser: jest.fn(),
  requestPasswordReset: jest.fn(),
  resetPassword: jest.fn(),
});

const mockTokenService = () => ({
  cookieName: 'muixer_rt',
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => process.env[key]),
});

const mockResponse = () =>
  ({
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  }) as unknown as Response;

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useFactory: mockAuthService },
        { provide: TokenService, useFactory: mockTokenService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
  });

  describe('login', () => {
    it('logs in and sets the refresh token cookie', async () => {
      authService.login.mockResolvedValue({
        response: { accessToken: 'access', user: { role: UserRole.TECHNICAL } },
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();
      const req = { user: { id: 'u1', email: 'a@b.cat', role: UserRole.TECHNICAL, isActive: true, person: null } };

      const result = await controller.login(
        { email: 'a@b.cat', password: 'pw', clientType: ClientType.DASHBOARD },
        req as never,
        res,
      );

      expect(result.accessToken).toBe('access');
      expect(res.cookie).toHaveBeenCalledWith(
        'muixer_rt',
        'refresh-token',
        expect.objectContaining({ httpOnly: true, path: '/api/auth' }),
      );
    });
  });

  describe('refresh', () => {
    it('throws UnauthorizedException when there is no refresh token cookie', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(UnauthorizedException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('rotates the refresh token and sets a new cookie', async () => {
      authService.refresh.mockResolvedValue({
        response: { accessToken: 'new-access', user: { role: UserRole.TECHNICAL } },
        newRefreshToken: 'new-refresh-token',
        clientType: ClientType.DASHBOARD,
      });
      const req = { cookies: { muixer_rt: 'old-refresh-token' } } as unknown as Request;
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(result.accessToken).toBe('new-access');
      expect(res.cookie).toHaveBeenCalledWith('muixer_rt', 'new-refresh-token', expect.anything());
    });

    it('sets the cookie TTL from the clientType returned by the service, not the user role (BUG-5)', async () => {
      // A TECHNICAL user whose *session* is a PWA one — role and clientType
      // diverge on purpose here to prove the cookie TTL follows the stored
      // clientType, not a role-based guess.
      authService.refresh.mockResolvedValue({
        response: { accessToken: 'new-access', user: { role: UserRole.TECHNICAL } },
        newRefreshToken: 'new-refresh-token',
        clientType: ClientType.PWA,
      });
      const req = { cookies: { muixer_rt: 'old-refresh-token' } } as unknown as Request;
      const res = mockResponse();

      await controller.refresh(req, res);

      const [, , options] = (res.cookie as jest.Mock).mock.calls[0];
      expect(options.maxAge).toBe(JWT_REFRESH_TTL_PWA * 1000);
      expect(options.maxAge).not.toBe(JWT_REFRESH_TTL_DASHBOARD * 1000);
    });
  });

  describe('logout', () => {
    it('revokes the refresh token and clears the cookie', async () => {
      const req = { cookies: { muixer_rt: 'raw-token' } } as unknown as Request;
      const res = mockResponse();

      await controller.logout(req, res);

      expect(authService.logout).toHaveBeenCalledWith('raw-token');
      expect(res.clearCookie).toHaveBeenCalledWith('muixer_rt', { path: '/api/auth' });
    });

    it('clears the cookie without calling the service when there is no token', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await controller.logout(req, res);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  describe('logoutAll', () => {
    it('revokes all sessions for the current user and clears the cookie', async () => {
      const res = mockResponse();

      await controller.logoutAll({ sub: 'user-1' } as never, res);

      expect(authService.logoutAll).toHaveBeenCalledWith('user-1');
      expect(res.clearCookie).toHaveBeenCalled();
    });
  });

  describe('getMe', () => {
    it('returns the profile for the authenticated user', async () => {
      authService.getMe.mockResolvedValue({ id: 'user-1' });

      const result = await controller.getMe({ sub: 'user-1' } as never);

      expect(authService.getMe).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ id: 'user-1' });
    });
  });

  describe('registerViaInvite', () => {
    it('activates the account and sets the refresh cookie', async () => {
      authService.registerViaInvite.mockResolvedValue({
        response: { accessToken: 'access', user: { role: UserRole.MEMBER } },
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();
      const dto = { token: 'invite-token', password: 'pw' };

      const result = await controller.registerViaInvite(dto as never, res);

      expect(authService.registerViaInvite).toHaveBeenCalledWith(dto);
      expect(result.accessToken).toBe('access');
      expect(res.cookie).toHaveBeenCalledWith('muixer_rt', 'refresh-token', expect.anything());
    });
  });

  describe('getInviteContext', () => {
    it('delegates to AuthService with the token', async () => {
      const context = { person: { name: 'Joan' }, expiresAt: '2026-01-01', legalDocument: {} };
      authService.getInviteContext.mockResolvedValue(context);

      const result = await controller.getInviteContext('invite-token');

      expect(authService.getInviteContext).toHaveBeenCalledWith('invite-token');
      expect(result).toEqual(context);
    });
  });

  describe('setupUser', () => {
    const original = process.env['SETUP_TOKEN'];

    afterEach(() => {
      if (original === undefined) delete process.env['SETUP_TOKEN'];
      else process.env['SETUP_TOKEN'] = original;
    });

    it('throws ForbiddenException when SETUP_TOKEN is not configured', async () => {
      delete process.env['SETUP_TOKEN'];

      await expect(
        controller.setupUser('anything', { email: 'a@b.cat', password: 'pw' }),
      ).rejects.toThrow(ForbiddenException);
      expect(authService.setupUser).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when the provided token does not match', async () => {
      process.env['SETUP_TOKEN'] = 'expected-token';

      await expect(
        controller.setupUser('wrong-token', { email: 'a@b.cat', password: 'pw' }),
      ).rejects.toThrow(ForbiddenException);
      expect(authService.setupUser).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException (not a raw crash) when the token has the same length but differs', async () => {
      process.env['SETUP_TOKEN'] = 'expected-token';

      await expect(
        controller.setupUser('expected-tokeX', { email: 'a@b.cat', password: 'pw' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException (not a raw crash) when the header is missing entirely', async () => {
      process.env['SETUP_TOKEN'] = 'expected-token';

      await expect(
        controller.setupUser(undefined as never, { email: 'a@b.cat', password: 'pw' }),
      ).rejects.toThrow(ForbiddenException);
      expect(authService.setupUser).not.toHaveBeenCalled();
    });

    it('creates the user when the token matches', async () => {
      process.env['SETUP_TOKEN'] = 'expected-token';
      authService.setupUser.mockResolvedValue({ id: 'new-user' });

      const result = await controller.setupUser('expected-token', {
        email: 'a@b.cat',
        password: 'pw',
      });

      expect(authService.setupUser).toHaveBeenCalledWith({ email: 'a@b.cat', password: 'pw' });
      expect(result).toEqual({ id: 'new-user' });
    });
  });

  describe('forgotPassword', () => {
    it('delegates to the service and returns a generic message', async () => {
      authService.requestPasswordReset.mockResolvedValue(undefined);

      const result = await controller.forgotPassword({ email: 'a@b.cat' });

      expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@b.cat');
      expect(result.message).toEqual(expect.any(String));
    });

    it('returns the same generic message even if the service silently no-ops for an unknown email', async () => {
      authService.requestPasswordReset.mockResolvedValue(undefined);

      const known = await controller.forgotPassword({ email: 'known@b.cat' });
      const unknown = await controller.forgotPassword({ email: 'unknown@b.cat' });

      expect(known.message).toBe(unknown.message);
    });
  });

  describe('resetPassword', () => {
    it('delegates to the service', async () => {
      authService.resetPassword.mockResolvedValue(undefined);

      await controller.resetPassword({ token: 'tok', password: 'newpass123' });

      expect(authService.resetPassword).toHaveBeenCalledWith({ token: 'tok', password: 'newpass123' });
    });

    it('propagates UnauthorizedException from an invalid/expired token', async () => {
      authService.resetPassword.mockRejectedValue(new UnauthorizedException());

      await expect(
        controller.resetPassword({ token: 'bad', password: 'newpass123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
