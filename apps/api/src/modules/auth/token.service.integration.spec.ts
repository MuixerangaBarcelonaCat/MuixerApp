import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { ClientType, UserRole } from '@muixer/shared';
import { TokenService } from './token.service';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from '../user/user.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * An admin revoking a session while that session refreshes: the rotation must not leave a fresh,
 * non-revoked token behind in the revoked family. Only real Postgres shows the interleaving.
 */
describe('TokenService (integration)', () => {
  let db: IntegrationDb;
  let service: TokenService;
  let tokenRepo: Repository<RefreshToken>;
  let user: User;
  const ROUNDS = 30;

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenService, ...realRepositoryProviders(db.dataSource, [RefreshToken])],
    }).compile();
    service = module.get(TokenService);
    tokenRepo = db.dataSource.getRepository(RefreshToken);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  beforeEach(async () => {
    const userRepo = db.dataSource.getRepository(User);
    user = await userRepo.save(userRepo.create({ email: 'race@test.cat', role: UserRole.MEMBER, isActive: true }));
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const familyOf = async () =>
    (await tokenRepo.findOneOrFail({ where: { userId: user.id }, order: { createdAt: 'DESC' } })).family;

  /** Counts rounds where the session kept refreshing after the revoke returned. */
  const survivors = async (revoke: (family: string) => Promise<unknown>) => {
    let survived = 0;
    for (let i = 0; i < ROUNDS; i++) {
      const raw = await service.createRefreshToken(user, ClientType.PWA);
      const family = await familyOf();
      const [rotated] = await Promise.allSettled([service.rotateRefreshToken(raw), revoke(family)]);
      if (rotated.status !== 'fulfilled') continue;
      const again = await service.rotateRefreshToken(rotated.value.newRawToken).then(
        () => true,
        () => false,
      );
      if (again) survived++;
    }
    return survived;
  };

  it('listActiveSessions: one row per usable family, newest first, with the newest row\'s label', async () => {
    const at = (iso: string) => new Date(iso);
    const future = at('2999-01-01T00:00:00Z');
    const seed = (family: string, over: Partial<RefreshToken>) =>
      tokenRepo.save(tokenRepo.create({ userId: user.id, tokenHash: `${family}-${Math.random()}`, family, clientType: ClientType.PWA, expiresAt: future, ...over }));
    const fa = '00000000-0000-4000-8000-00000000000a';
    const fb = '00000000-0000-4000-8000-00000000000b';
    const fc = '00000000-0000-4000-8000-00000000000c';
    const fd = '00000000-0000-4000-8000-00000000000d';
    const fe = '00000000-0000-4000-8000-00000000000e';
    await seed(fa, { userAgent: 'UA-old', createdAt: at('2026-03-01T00:00:00Z'), expiresAt: at('2998-01-01T00:00:00Z'), usedAt: at('2026-03-02T00:00:00Z') });
    await seed(fa, { userAgent: 'UA-new', createdAt: at('2026-03-02T00:00:00Z') });
    await seed(fb, { clientType: ClientType.DASHBOARD, userAgent: 'B', createdAt: at('2026-03-01T12:00:00Z') });
    await seed(fc, { createdAt: at('2026-02-01T00:00:00Z'), usedAt: at('2026-02-02T00:00:00Z') }); // only used
    await seed(fd, { createdAt: at('2020-01-01T00:00:00Z'), expiresAt: at('2020-01-08T00:00:00Z') }); // expired
    await seed(fe, { createdAt: at('2026-03-03T00:00:00Z'), revokedAt: at('2026-03-03T01:00:00Z') }); // revoked

    expect(await service.listActiveSessions(user.id)).toEqual([
      { family: fa, clientType: ClientType.PWA, userAgent: 'UA-new', startedAt: '2026-03-01T00:00:00.000Z', lastRefreshAt: '2026-03-02T00:00:00.000Z', expiresAt: future.toISOString() },
      { family: fb, clientType: ClientType.DASHBOARD, userAgent: 'B', startedAt: '2026-03-01T12:00:00.000Z', lastRefreshAt: '2026-03-01T12:00:00.000Z', expiresAt: future.toISOString() },
    ]);
  });

  it('revokeFamily: a refresh in flight does not keep the session alive', async () => {
    expect(await survivors((family) => service.revokeFamily(user.id, family))).toBe(0);
  });

  it('revokeAllUserTokens: a refresh in flight does not keep the session alive', async () => {
    expect(await survivors(() => service.revokeAllUserTokens(user.id))).toBe(0);
  });
});
