import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { Response, Request } from 'express';
import { ClientType, UserRole } from '@muixer/shared';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { JWT_REFRESH_TTL_DASHBOARD, JWT_REFRESH_TTL_PWA, REFRESH_TOKEN_COOKIE } from './constants/auth.constants';

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
  cookieName: REFRESH_TOKEN_COOKIE,
  revokeToken: jest.fn(),
});

const mockResponse = (): Partial<Response> => ({
  cookie: jest.fn(),
  clearCookie: jest.fn(),
});

const mockRequest = (cookies: Record<string, string> = {}): Partial<Request> => ({
  cookies,
});

describe('AuthController', () => {
  let controller: AuthController;
  let authService: ReturnType<typeof mockAuthService>;
  let res: ReturnType<typeof mockResponse>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useFactory: mockAuthService },
        { provide: TokenService, useFactory: mockTokenService },
      ],
    }).compile();

    controller = module.get(AuthController);
    authService = module.get(AuthService);
    res = mockResponse();
  });

  describe('refresh', () => {
    it('throws ForbiddenException when no cookie', async () => {
      const req = mockRequest({});
      await expect(
        controller.refresh(req as Request, res as Response),
      ).rejects.toThrow(ForbiddenException);
    });

    it('sets cookie with PWA TTL when stored clientType is PWA', async () => {
      authService.refresh.mockResolvedValue({
        response: {
          accessToken: 'at',
          user: { id: 'u1', email: 'a@b.cat', role: UserRole.TECHNICAL, isActive: true, person: null },
        },
        newRefreshToken: 'new-rt',
        clientType: ClientType.PWA,
      });
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE]: 'old-rt' });

      await controller.refresh(req as Request, res as Response);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'new-rt',
        expect.objectContaining({ maxAge: JWT_REFRESH_TTL_PWA * 1000 }),
      );
    });

    it('sets cookie with DASHBOARD TTL when stored clientType is DASHBOARD', async () => {
      authService.refresh.mockResolvedValue({
        response: {
          accessToken: 'at',
          user: { id: 'u1', email: 'a@b.cat', role: UserRole.MEMBER, isActive: true, person: null },
        },
        newRefreshToken: 'new-rt',
        clientType: ClientType.DASHBOARD,
      });
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE]: 'old-rt' });

      await controller.refresh(req as Request, res as Response);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'new-rt',
        expect.objectContaining({ maxAge: JWT_REFRESH_TTL_DASHBOARD * 1000 }),
      );
    });

    it('uses stored clientType, not user role (TECHNICAL via PWA keeps PWA TTL)', async () => {
      authService.refresh.mockResolvedValue({
        response: {
          accessToken: 'at',
          user: { id: 'u1', email: 'tech@b.cat', role: UserRole.TECHNICAL, isActive: true, person: null },
        },
        newRefreshToken: 'new-rt',
        clientType: ClientType.PWA,
      });
      const req = mockRequest({ [REFRESH_TOKEN_COOKIE]: 'old-rt' });

      await controller.refresh(req as Request, res as Response);

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'new-rt',
        expect.objectContaining({ maxAge: JWT_REFRESH_TTL_PWA * 1000 }),
      );
    });
  });

  describe('acceptInvite', () => {
    it('sets cookie with clientType from service', async () => {
      authService.acceptInvite.mockResolvedValue({
        response: {
          accessToken: 'at',
          user: { id: 'u1', email: 'a@b.cat', role: UserRole.MEMBER, isActive: true, person: null },
        },
        refreshToken: 'rt',
        clientType: ClientType.PWA,
      });

      await controller.acceptInvite(
        { token: 'invite-tok', password: 'pass123!' },
        res as Response,
      );

      expect(res.cookie).toHaveBeenCalledWith(
        REFRESH_TOKEN_COOKIE,
        'rt',
        expect.objectContaining({ maxAge: JWT_REFRESH_TTL_PWA * 1000 }),
      );
    });
  });
});
