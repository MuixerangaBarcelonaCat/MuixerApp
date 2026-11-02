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
describe('TokenService revoke vs rotate (integration)', () => {
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

  it('revokeFamily: a refresh in flight does not keep the session alive', async () => {
    expect(await survivors((family) => service.revokeFamily(user.id, family))).toBe(0);
  });

  it('revokeAllUserTokens: a refresh in flight does not keep the session alive', async () => {
    expect(await survivors(() => service.revokeAllUserTokens(user.id))).toBe(0);
  });
});
