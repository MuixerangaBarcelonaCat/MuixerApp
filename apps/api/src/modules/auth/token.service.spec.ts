import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { And, IsNull, LessThan, Not } from 'typeorm';
import { createHash } from 'crypto';
import { ClientType } from '@muixer/shared';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
});

const hash = (t: string) => createHash('sha256').update(t).digest('hex');

describe('TokenService', () => {
  let service: TokenService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: getRepositoryToken(RefreshToken), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(TokenService);
    repo = module.get(getRepositoryToken(RefreshToken));
  });

  describe('createRefreshToken', () => {
    it('generates an opaque random token and stores its hash (ARCH-3: no JWT signing)', async () => {
      repo.create.mockImplementation((entity) => entity);
      repo.save.mockResolvedValue({});

      const result = await service.createRefreshToken(
        { id: 'user-uuid' } as Parameters<typeof service.createRefreshToken>[0],
        ClientType.DASHBOARD,
      );

      // 32 random bytes, hex-encoded — validity is decided entirely by the
      // DB row (SEC-5/ARCH-3), so there is nothing to sign or verify.
      expect(result).toMatch(/^[0-9a-f]{64}$/);
      expect(repo.save).toHaveBeenCalled();
      const savedEntity = repo.create.mock.calls[0][0] as { tokenHash: string };
      expect(savedEntity.tokenHash).toBe(hash(result));
    });

    it('generates a different token on every call', async () => {
      repo.create.mockImplementation((entity) => entity);
      repo.save.mockResolvedValue({});
      const user = { id: 'user-uuid' } as Parameters<typeof service.createRefreshToken>[0];

      const first = await service.createRefreshToken(user, ClientType.DASHBOARD);
      const second = await service.createRefreshToken(user, ClientType.DASHBOARD);

      expect(first).not.toBe(second);
    });
  });

  describe('rotateRefreshToken', () => {
    it('claims the token via an atomic conditional update, then creates a new one', async () => {
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
      repo.update.mockResolvedValue({ affected: 1 });
      const newToken = 'new-jwt';
      jest.spyOn(service, 'createRefreshToken').mockResolvedValue(newToken);

      const result = await service.rotateRefreshToken(rawToken);

      // The claim must be a single WHERE id = ... AND usedAt IS NULL update —
      // never a plain findOne-then-update — so a concurrent request racing
      // for the same row can't both succeed (SEC-5).
      expect(repo.update).toHaveBeenCalledWith(
        { id: 'rt-id', usedAt: IsNull() },
        { usedAt: expect.any(Date) },
      );
      expect(result.newRawToken).toBe(newToken);
      expect(result.userId).toBe('user-uuid');
      // BUG-5: the caller must use this stored clientType for the cookie TTL,
      // not re-derive it from the user's role.
      expect(result.clientType).toBe(ClientType.DASHBOARD);
    });

    it('revokes entire family when the atomic usedAt claim affects zero rows (reuse or lost race)', async () => {
      const rawToken = 'reused-jwt';
      repo.findOne.mockResolvedValue({
        id: 'rt-id',
        userId: 'u1',
        tokenHash: hash(rawToken),
        family: 'fam-x',
        clientType: ClientType.DASHBOARD,
        expiresAt: new Date(Date.now() + 3600_000),
        usedAt: null,
        revokedAt: null,
      });
      // Zero rows affected simulates either genuine prior use or a concurrent
      // request that won the race for the same row — both must be treated
      // as reuse.
      repo.update.mockResolvedValueOnce({ affected: 0 });
      repo.update.mockResolvedValueOnce({});

      await expect(service.rotateRefreshToken(rawToken)).rejects.toThrow('Token reutilitzat detectat');
      expect(repo.update).toHaveBeenNthCalledWith(
        2,
        { family: 'fam-x' },
        { revokedAt: expect.any(Date) },
      );
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

  describe('cleanupExpiredTokens', () => {
    it('deletes tokens expired more than 30 days ago', async () => {
      repo.delete.mockResolvedValue({ affected: 3 });

      await service.cleanupExpiredTokens();

      expect(repo.delete).toHaveBeenCalledTimes(2);
      expect(repo.delete).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ expiresAt: expect.anything() }),
      );
    });

    it('deletes tokens revoked more than 30 days ago — independent of expiresAt (BUG-6)', async () => {
      repo.delete.mockResolvedValue({ affected: 3 });

      await service.cleanupExpiredTokens();

      // The old second condition (`revokedAt IS NOT NULL AND expiresAt < now-30d`) was a strict
      // subset of the first delete's criteria and could never match anything on its own. It must
      // key off revokedAt exclusively: `revokedAt IS NOT NULL AND revokedAt < now-30d`.
      expect(repo.delete).toHaveBeenNthCalledWith(2, {
        revokedAt: And(Not(IsNull()), LessThan(expect.any(Date))),
      });
    });

    it('does not log when no tokens are deleted', async () => {
      repo.delete.mockResolvedValue({ affected: 0 });
      const logSpy = jest.spyOn(service['logger'], 'log');

      await service.cleanupExpiredTokens();

      expect(logSpy).not.toHaveBeenCalled();
    });
  });
});
