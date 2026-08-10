import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { AuditAction, ClientType, UserRole } from '@muixer/shared';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { LegalDocumentService } from '../legal/legal-document.service';
import { AuditService } from '../audit/audit.service';
import { hashToken } from '../../common/utils/hash-token.util';

const makeTransactionManager = () => ({
  create: jest.fn((_entity: unknown, data: unknown) => data),
  save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
  update: jest.fn().mockResolvedValue({ affected: 1 }),
  findOne: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
});

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
    privacyPolicyAcceptedAt: null,
    privacyPolicyVersion: null,
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

const mockDataSource = () => ({
  transaction: jest.fn(),
});

const mockLegalService = () => ({
  getConsentVersion: jest.fn().mockResolvedValue(null),
});

const mockAuditService = () => ({
  record: jest.fn().mockResolvedValue(undefined),
});

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: ReturnType<typeof mockUserRepo>;
  let personRepo: ReturnType<typeof mockPersonRepo>;
  let tokenService: ReturnType<typeof mockTokenService>;
  let dataSource: ReturnType<typeof mockDataSource>;
  let legalService: ReturnType<typeof mockLegalService>;
  let auditService: ReturnType<typeof mockAuditService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getRepositoryToken(User), useFactory: mockUserRepo },
        { provide: getRepositoryToken(Person), useFactory: mockPersonRepo },
        { provide: JwtService, useFactory: mockJwt },
        { provide: TokenService, useFactory: mockTokenService },
        { provide: ConfigService, useFactory: mockConfigService },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: LegalDocumentService, useFactory: mockLegalService },
        { provide: AuditService, useFactory: mockAuditService },
      ],
    }).compile();

    service = module.get(AuthService);
    userRepo = module.get(getRepositoryToken(User));
    personRepo = module.get(getRepositoryToken(Person));
    tokenService = module.get(TokenService);
    dataSource = module.get(DataSource);
    legalService = module.get(LegalDocumentService);
    auditService = module.get(AuditService);
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

    it('loads the person relation, without any managedBy join (BUG-7 no longer needs one)', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await service.getMe('user-1');

      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ relations: expect.arrayContaining(['person']) }),
      );
    });

    it('returns the caller\'s own email as person.email, since person is always the caller\'s own profile (BUG-7)', async () => {
      const user = makeUser({
        email: 'joan@test.cat',
        person: {
          id: 'person-1',
          name: 'Joan',
          firstSurname: 'Prat',
          alias: 'JoanP',
        } as unknown as Person,
      });
      userRepo.findOne.mockResolvedValue(user);

      const profile = await service.getMe('user-1');

      expect(profile.person?.email).toBe('joan@test.cat');
    });
  });

  describe('privacy consent (requiresPrivacyConsent, driven by the consent watermark)', () => {
    it('is false when no version has ever required consent', async () => {
      legalService.getConsentVersion.mockResolvedValue(null);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: null }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(false);
    });

    it('is true when the user has never accepted and a watermark exists', async () => {
      legalService.getConsentVersion.mockResolvedValue(1);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: null }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(true);
    });

    it('is true when the accepted version is older than the watermark', async () => {
      legalService.getConsentVersion.mockResolvedValue(3);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: 2 }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(true);
    });

    it('is false when the accepted version matches the watermark', async () => {
      legalService.getConsentVersion.mockResolvedValue(3);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: 3 }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(false);
    });

    it('stays false after a correction is published (the active text moves but the watermark does not)', async () => {
      // Simulates: user accepted v1 (the watermark); an admin then publishes v2 as a correction
      // (requiresConsent: false), so the watermark is still 1 — getConsentVersion reflects that.
      legalService.getConsentVersion.mockResolvedValue(1);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: 1 }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(false);
    });

    it('becomes true once a substantive change moves the watermark past what the user accepted', async () => {
      // Same user as above, but now an admin publishes v3 as a substantive change
      // (requiresConsent: true), moving the watermark to 3.
      legalService.getConsentVersion.mockResolvedValue(3);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: 1 }));

      const profile = await service.getMe('user-1');
      expect(profile.requiresPrivacyConsent).toBe(true);
    });
  });

  describe('acceptPrivacyPolicy', () => {
    it('stores the acceptance timestamp and the consent watermark version, and records an audit entry', async () => {
      legalService.getConsentVersion.mockResolvedValue(2);
      userRepo.findOne.mockResolvedValue(makeUser({ privacyPolicyVersion: null }));
      userRepo.update.mockResolvedValue({});

      const profile = await service.acceptPrivacyPolicy('user-1', '1.2.3.4');

      expect(userRepo.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ privacyPolicyVersion: 2, privacyPolicyAcceptedAt: expect.any(Date) }),
      );
      expect(auditService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: AuditAction.CONSENT_ACCEPTED,
          actorUserId: 'user-1',
          ipAddress: '1.2.3.4',
        }),
      );
      // After accepting, the profile no longer requires consent.
      expect(profile.requiresPrivacyConsent).toBe(false);
      expect(profile.privacyPolicyAcceptedAt).not.toBeNull();
    });

    it('throws when the user does not exist', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.acceptPrivacyPolicy('missing')).rejects.toThrow(UnauthorizedException);
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

    it('looks up the invite by the hash of the raw token, never the raw token itself', async () => {
      const user = makeUser({
        inviteToken: hashToken('valid-token'),
        inviteExpiresAt: new Date(Date.now() + 3600_000),
        isActive: false,
        passwordHash: '',
      });
      userRepo.findOne.mockResolvedValue(user);
      userRepo.update.mockResolvedValue({});
      bcrypt.hash.mockResolvedValue('new-hash');

      await service.acceptInvite({ token: 'valid-token', password: 'newpass123' });

      expect(userRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { inviteToken: hashToken('valid-token') } }),
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
      bcrypt.hash.mockResolvedValue('hashed-pw');

      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(saved); // user save
      manager.findOne.mockResolvedValueOnce(saved); // reload after save
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const profile = await service.setupUser({ email: 'new@test.cat', password: 'pass1234' });

      expect(manager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(profile.role).toBe(UserRole.ADMIN);
    });

    it('links personId inside the same transaction as user creation, via the entity manager rather than raw SQL', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.count.mockResolvedValue(0);
      personRepo.findOne.mockResolvedValue({ id: 'person-1' });
      const saved = makeUser({ id: 'user-1', role: UserRole.ADMIN });
      bcrypt.hash.mockResolvedValue('hashed-pw');

      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(saved);
      manager.findOne.mockResolvedValueOnce(saved);
      dataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.setupUser({
        email: 'new@test.cat',
        password: 'pass1234',
        personId: 'person-1',
      });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.query).not.toHaveBeenCalled();
      expect(manager.update).toHaveBeenCalledWith(User, 'user-1', {
        person: { id: 'person-1' },
      });
    });

    it('throws NotFoundException when personId does not reference an existing person', async () => {
      process.env['SETUP_TOKEN'] = 'secret';
      userRepo.count.mockResolvedValue(0);
      personRepo.findOne.mockResolvedValue(null);

      await expect(
        service.setupUser({
          email: 'new@test.cat',
          password: 'pass1234',
          personId: 'missing-person',
        }),
      ).rejects.toThrow(NotFoundException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
