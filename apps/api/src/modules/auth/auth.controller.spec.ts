import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClientType, UserRole } from '@muixer/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';

const mockAuthService = () => ({
  login: jest.fn(),
  refresh: jest.fn(),
  logout: jest.fn(),
  logoutAll: jest.fn(),
  getMe: jest.fn(),
  acceptInvite: jest.fn(),
  setupUser: jest.fn(),
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
    it('throws ForbiddenException when there is no refresh token cookie', async () => {
      const req = { cookies: {} } as unknown as Request;
      const res = mockResponse();

      await expect(controller.refresh(req, res)).rejects.toThrow(ForbiddenException);
      expect(authService.refresh).not.toHaveBeenCalled();
    });

    it('rotates the refresh token and sets a new cookie', async () => {
      authService.refresh.mockResolvedValue({
        response: { accessToken: 'new-access', user: { role: UserRole.TECHNICAL } },
        newRefreshToken: 'new-refresh-token',
      });
      const req = { cookies: { muixer_rt: 'old-refresh-token' } } as unknown as Request;
      const res = mockResponse();

      const result = await controller.refresh(req, res);

      expect(authService.refresh).toHaveBeenCalledWith('old-refresh-token');
      expect(result.accessToken).toBe('new-access');
      expect(res.cookie).toHaveBeenCalledWith('muixer_rt', 'new-refresh-token', expect.anything());
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

  describe('acceptInvite', () => {
    it('activates the account and sets the refresh cookie', async () => {
      authService.acceptInvite.mockResolvedValue({
        response: { accessToken: 'access', user: { role: UserRole.MEMBER } },
        refreshToken: 'refresh-token',
      });
      const res = mockResponse();

      const result = await controller.acceptInvite({ token: 'invite-token', password: 'pw' }, res);

      expect(result.accessToken).toBe('access');
      expect(res.cookie).toHaveBeenCalledWith('muixer_rt', 'refresh-token', expect.anything());
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
});
