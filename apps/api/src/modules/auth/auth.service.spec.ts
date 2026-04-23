import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ClientType, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const bcrypt = require('bcrypt') as { compare: jest.Mock; hash: jest.Mock };

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
  create: jest.fn(),
  save: jest.fn(),
  update: jest.fn(),
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

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let personRepo: ReturnType<typeof mockPersonRepo>;
  let tokenService: ReturnType<typeof mockTokenService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Person), useFactory: mockPersonRepo },
        { provide: JwtService, useFactory: mockJwt },
        { provide: TokenService, useFactory: mockTokenService },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    personRepo = module.get(getRepositoryToken(Person));
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
  });

  describe('login', () => {
    it('returns access token and calls createRefreshToken', async () => {
      const user = makeUser();
      const { response, refreshToken } = await service.login(user, ClientType.DASHBOARD);
      expect(response.accessToken).toBe('access-token');
      expect(refreshToken).toBe('refresh-token');
      expect(tokenService.createRefreshToken).toHaveBeenCalledWith(user, ClientType.DASHBOARD);
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
    it('throws when SETUP_TOKEN env var is not set', async () => {
      delete process.env['SETUP_TOKEN'];
      await expect(
        service.setupUser({ email: 'a@b.cat', password: 'pass1234' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('creates a new TECHNICAL user by default', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-pw');
      const saved = makeUser({ role: UserRole.TECHNICAL });
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      const profile = await service.setupUser({ email: 'new@test.cat', password: 'pass1234' });
      expect(profile.id).toBe('user-1');
      delete process.env['SETUP_TOKEN'];
    });

    it('creates an ADMIN user when role is specified', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.findOne.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-pw');
      const saved = makeUser({ role: UserRole.ADMIN });
      userRepo.create.mockReturnValue(saved);
      userRepo.save.mockResolvedValue(saved);

      const profile = await service.setupUser({ email: 'admin@test.cat', password: 'pass1234', role: UserRole.ADMIN });
      expect(profile.role).toBe(UserRole.ADMIN);
      delete process.env['SETUP_TOKEN'];
    });

    it('is idempotent — returns existing user if email already exists', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      const existing = makeUser();
      userRepo.findOne.mockResolvedValue(existing);

      const profile = await service.setupUser({ email: 'test@test.cat', password: 'pass1234' });
      expect(userRepo.save).not.toHaveBeenCalled();
      expect(profile.email).toBe('test@test.cat');
      delete process.env['SETUP_TOKEN'];
    });
  });
});
