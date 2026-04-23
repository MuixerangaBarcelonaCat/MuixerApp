import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { createHash } from 'crypto';
import { ClientType } from '@muixer/shared';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const mockJwt = () => ({
  signAsync: jest.fn(),
});

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

describe('TokenService', () => {
  let service: TokenService;
  let repo: ReturnType<typeof mockRepo>;
  let jwt: ReturnType<typeof mockJwt>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRepo },
        { provide: JwtService, useFactory: mockJwt },
      ],
    }).compile();

    service = module.get(TokenService);
    repo = module.get(getRepositoryToken(RefreshToken));
    jwt = module.get(JwtService);
  });

  describe('createRefreshToken', () => {
    it('signs a JWT and stores its hash', async () => {
      const rawToken = 'signed-jwt-string';
      jwt.signAsync.mockResolvedValue(rawToken);
      repo.create.mockReturnValue({ tokenHash: hash(rawToken) });
      repo.save.mockResolvedValue({});

      const result = await service.createRefreshToken(
        { id: 'user-uuid' } as Parameters<typeof service.createRefreshToken>[0],
        ClientType.DASHBOARD,
      );

      expect(result).toBe(rawToken);
      expect(repo.save).toHaveBeenCalled();
      const savedEntity = repo.create.mock.calls[0][0] as { tokenHash: string };
      expect(savedEntity.tokenHash).toBe(hash(rawToken));
    });
  });

  describe('rotateRefreshToken', () => {
    it('marks old token as used and creates a new one', async () => {
      const rawToken = 'old-jwt';
      const now = new Date();
      const stored: Partial<RefreshToken> = {
        id: 'rt-id',
        userId: 'user-uuid',
        tokenHash: hash(rawToken),
        family: 'family-uuid',
        clientType: ClientType.DASHBOARD,
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
        revokedAt: null,
        createdAt: now,
      };

      repo.findOne.mockResolvedValue(stored);
      repo.update.mockResolvedValue({});
      const newToken = 'new-jwt';
      jest.spyOn(service, 'createRefreshToken').mockResolvedValue(newToken);

      const result = await service.rotateRefreshToken(rawToken);

      expect(repo.update).toHaveBeenCalledWith('rt-id', { usedAt: expect.any(Date) });
      expect(result.newRawToken).toBe(newToken);
      expect(result.userId).toBe('user-uuid');
    });

    it('revokes entire family when token has already been used (reuse detected)', async () => {
      const rawToken = 'reused-jwt';
      repo.findOne.mockResolvedValue({
        id: 'rt-id',
        userId: 'u1',
        tokenHash: hash(rawToken),
        family: 'fam-x',
        clientType: ClientType.DASHBOARD,
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: new Date(),
        revokedAt: null,
      });
      repo.update.mockResolvedValue({});

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow('Token reutilitzat detectat');
      expect(repo.update).toHaveBeenCalledWith({ family: 'fam-x' }, { revokedAt: expect.any(Date) });
    });

    it('rejects revoked token', async () => {
      const rawToken = 'revoked-jwt';
      repo.findOne.mockResolvedValue({
        id: 'rt-id',
        userId: 'u1',
        tokenHash: hash(rawToken),
        family: 'fam-y',
        clientType: ClientType.DASHBOARD,
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
        revokedAt: new Date(),
      });

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow('Token revocat');
    });

    it('rejects expired token', async () => {
      const rawToken = 'expired-jwt';
      repo.findOne.mockResolvedValue({
        id: 'rt-id',
        userId: 'u1',
        tokenHash: hash(rawToken),
        family: 'fam-z',
        clientType: ClientType.DASHBOARD,
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
        revokedAt: null,
      });

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow('Token caducat');
    });
  });

  describe('revokeToken', () => {
    it('sets revokedAt on the matching token', async () => {
      repo.update.mockResolvedValue({});
      await service.revokeToken('some-raw-token');
      expect(repo.update).toHaveBeenCalledWith(
        { tokenHash: hash('some-raw-token') },
        { revokedAt: expect.any(Date) },
      );
    });
  });

  describe('revokeAllUserTokens', () => {
    it('revokes all tokens for a given userId', async () => {
      repo.update.mockResolvedValue({});
      await service.revokeAllUserTokens('user-uuid');
      expect(repo.update).toHaveBeenCalledWith({ userId: 'user-uuid' }, { revokedAt: expect.any(Date) });
    });
  });
});
