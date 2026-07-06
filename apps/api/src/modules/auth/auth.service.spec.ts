import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ClientType, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
  hashSync: jest.fn().mockReturnValue('dummy-hash'),
}));

const bcrypt = require('bcrypt') as { compare: jest.Mock; hash: jest.Mock; hashSync: jest.Mock };

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-1',
    email: 'test@test.cat',
    passwordHash: 'hashed',
    role: UserRole.TECHNICAL,
    isActive: true,
    inviteToken: null,
    inviteExpiresAt: null,
    resetToken: null,
    resetExpiresAt: null,
    person: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as User);

const mockUserRepo = () => ({
  findOne: jest.fn(),
  count: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
});

const mockPersonRepo = () => ({
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockJwt = () => ({ sign: jest.fn().mockReturnValue('access-token') });

const mockTokenService = () => ({
  createRefreshToken: jest.fn().mockResolvedValue('refresh-token'),
  revokeToken: jest.fn(),
  revokeAllUserTokens: jest.fn(),
  rotateRefreshToken: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn((key: string) => process.env[key]),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let tokenService: ReturnType<typeof mockTokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Person), useFactory: mockPersonRepo },
        { provide: JwtService, useFactory: mockJwt },
        { provide: TokenService, useFactory: mockTokenService },
        { provide: ConfigService, useFactory: mockConfigService },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    tokenService = module.get(TokenService);
  });

  describe('validateUser', () => {
    it('returns user when credentials are valid', async () => {
      const user = makeUser();
      userRepo.findOne.mockResolvedValue(user);
      bcrypt.compare.mockResolvedValue(true);

      const result = await service.validateUser('test@test.cat', 'pass');
      expect(result).toBe(user);
    });

    it('returns null when user is inactive', async () => {
      userRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));
      const result = await service.validateUser('test@test.cat', 'pass');
      expect(result).toBeNull();
    });

    it('returns null when password does not match', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      bcrypt.compare.mockResolvedValue(false);
      const result = await service.validateUser('test@test.cat', 'wrong');
      expect(result).toBeNull();
    });

    it('returns null when user is not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.validateUser('nope@test.cat', 'pass');
      expect(result).toBeNull();
    });

    it('still runs bcrypt.compare when the user does not exist (prevents user-enumeration via timing, SEC-13)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      bcrypt.compare.mockResolvedValue(false);

      await service.validateUser('nope@test.cat', 'pass');

      // toHaveBeenLastCalledWith, not toHaveBeenCalledWith: bcrypt.compare is a
      // shared mock across every test in this file with no reset in between,
      // so only the most recent call reliably reflects this test's own action.
      expect(bcrypt.compare).toHaveBeenLastCalledWith('pass', expect.any(String));
    });
  });

  describe('login', () => {
    it('returns access token and calls createRefreshToken', async () => {
      const user = makeUser();
      const { response, refreshToken } = await service.login(user, ClientType.DASHBOARD);
      expect(response.accessToken).toBe('access-token');
      expect(refreshToken).toBe('refresh-token');
      expect(tokenService.createRefreshToken).toHaveBeenCalledWith(user, ClientType.DASHBOARD);
    });

    it('throws UnauthorizedException when a MEMBER tries to log in via the dashboard client', async () => {
      const member = makeUser({ role: UserRole.MEMBER });

      await expect(service.login(member, ClientType.DASHBOARD)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(tokenService.createRefreshToken).not.toHaveBeenCalled();
    });

    it.each([UserRole.ADMIN, UserRole.TECHNICAL])(
      'allows %s to log in via the dashboard client',
      async (role) => {
        const user = makeUser({ role });
        const { response } = await service.login(user, ClientType.DASHBOARD);
        expect(response.accessToken).toBe('access-token');
      },
    );

    it.each([UserRole.ADMIN, UserRole.TECHNICAL, UserRole.MEMBER])(
      'allows %s to log in via the PWA client',
      async (role) => {
        const user = makeUser({ role });
        const { response } = await service.login(user, ClientType.PWA);
        expect(response.accessToken).toBe('access-token');
      },
    );
  });

  describe('refresh', () => {
    it('rotates the token and returns the stored clientType for the cookie (BUG-5)', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      tokenService.rotateRefreshToken.mockResolvedValue({
        newRawToken: 'new-refresh-token',
        userId: user.id,
        clientType: ClientType.PWA,
      });
      userRepo.findOne.mockResolvedValue(user);

      const result = await service.refresh('old-refresh-token');

      expect(result.newRefreshToken).toBe('new-refresh-token');
      expect(result.clientType).toBe(ClientType.PWA);
      expect(result.response.accessToken).toBe('access-token');
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      tokenService.rotateRefreshToken.mockResolvedValue({
        newRawToken: 'new-refresh-token',
        userId: 'missing-user',
        clientType: ClientType.PWA,
      });
      userRepo.findOne.mockResolvedValue(null);

      await expect(service.refresh('old-refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when the user is inactive', async () => {
      tokenService.rotateRefreshToken.mockResolvedValue({
        newRawToken: 'new-refresh-token',
        userId: 'user-1',
        clientType: ClientType.PWA,
      });
      userRepo.findOne.mockResolvedValue(makeUser({ isActive: false }));

      await expect(service.refresh('old-refresh-token')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('calls revokeToken', async () => {
      await service.logout('some-token');
      expect(tokenService.revokeToken).toHaveBeenCalledWith('some-token');
    });
  });

  describe('logoutAll', () => {
    it('calls revokeAllUserTokens', async () => {
      await service.logoutAll('user-1');
      expect(tokenService.revokeAllUserTokens).toHaveBeenCalledWith('user-1');
    });
  });

  describe('getMe', () => {
    it('returns user profile', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const profile = await service.getMe('user-1');
      expect(profile.id).toBe('user-1');
      expect(profile.email).toBe('test@test.cat');
    });

    it('throws when user not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.getMe('missing')).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('acceptInvite', () => {
    it('activates user and auto-logs in', async () => {
      const user = makeUser({
        inviteToken: 'valid-token',
        inviteExpiresAt: new Date(Date.now() + 3600_000),
        isActive: false,
        passwordHash: '',
      });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});
      bcrypt.hash.mockResolvedValue('new-hash');

      const result = await service.acceptInvite({ token: 'valid-token', password: 'newpass123' });
      expect(result.response.accessToken).toBe('access-token');
      expect(userRepo.update).toHaveBeenCalledWith(
        user.id,
        expect.objectContaining({ isActive: true, inviteToken: null }),
      );
    });

    it('throws for expired invite token', async () => {
      userRepo.findOne.mockResolvedValue(
        makeUser({ inviteToken: 'tok', inviteExpiresAt: new Date(Date.now() - 1000) }),
      );
      await expect(service.acceptInvite({ token: 'tok', password: 'pass123!' })).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws when token not found', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptInvite({ token: 'bad', password: 'pass123!' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('setupUser', () => {
    afterEach(() => {
      delete process.env['SETUP_TOKEN'];
    });

    it('throws when SETUP_TOKEN env var is not set', async () => {
      delete process.env['SETUP_TOKEN'];
      await expect(
        service.setupUser({ email: 'a@b.cat', password: 'pass1234' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws when a user already exists — this is a true one-time bootstrap, not a general admin-creation endpoint', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.count.mockResolvedValue(1);

      await expect(
        service.setupUser({ email: 'a@b.cat', password: 'pass1234' }),
      ).rejects.toThrow(ForbiddenException);
      // Must refuse before looking anything up by email — otherwise the endpoint
      // becomes an email-existence oracle even after bootstrap is complete.
      expect(userRepo.findOne).not.toHaveBeenCalled();
      expect(userRepo.save).not.toHaveBeenCalled();
    });

    it('creates the first user as ADMIN when the system has no users yet', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.count.mockResolvedValue(0);
      const saved = makeUser({ role: UserRole.ADMIN });
      userRepo.findOne.mockResolvedValue(saved); // reload after save
      bcrypt.hash.mockResolvedValue('hashed-pw');
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      const profile = await service.setupUser({ email: 'new@test.cat', password: 'pass1234' });

      expect(userRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(profile.role).toBe(UserRole.ADMIN);
    });
  });
});
