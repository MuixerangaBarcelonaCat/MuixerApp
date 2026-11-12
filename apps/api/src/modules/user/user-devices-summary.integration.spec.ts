import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ClientType, UserRole } from '@muixer/shared';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Person } from '../person/person.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { TokenService } from '../auth/token.service';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { PushSubscription } from '../push-notification/entities/push-subscription.entity';
import { USER_DEVICES_SORT_BY_FIELDS } from './constants/user-sort.constants';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';
import { CollaSettingsService } from '../colla-settings/colla-settings.service';
import { CollaSettingsStub } from '../colla-settings/colla-settings.stub';

/**
 * Real-Postgres suite for `UserService.findDevicesSummary`: the counts come from correlated
 * subqueries over `refresh_tokens` and `push_subscriptions`, so only a real database proves
 * which rows count as an open session or an active device.
 */
describe('UserService.findDevicesSummary (integration)', () => {
  let db: IntegrationDb;
  let service: UserService;
  let personRepo: Repository<Person>;
  let userRepo: Repository<User>;
  let tokenRepo: Repository<RefreshToken>;
  let pushRepo: Repository<PushSubscription>;

  const HOUR = 3600_000;
  const ago = (ms: number) => new Date(Date.now() - ms);
  const ahead = (ms: number) => new Date(Date.now() + ms);

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CollaSettingsService, useValue: new CollaSettingsStub() },
        UserService,
        TokenService,
        PersonDelegateService,
        ...realRepositoryProviders(db.dataSource, [User, Person, RefreshToken, PersonDelegate]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();
    service = module.get(UserService);
    personRepo = db.dataSource.getRepository(Person);
    userRepo = db.dataSource.getRepository(User);
    tokenRepo = db.dataSource.getRepository(RefreshToken);
    pushRepo = db.dataSource.getRepository(PushSubscription);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const seedUser = async (alias: string, overrides: Partial<User> = {}) => {
    const person = await personRepo.save(
      personRepo.create({ name: `Nom ${alias}`, firstSurname: 'Cognom', alias }),
    );
    return userRepo.save(
      userRepo.create({
        email: `${alias}@test.cat`,
        role: UserRole.MEMBER,
        isActive: true,
        person,
        ...overrides,
      }),
    );
  };

  const seedToken = (user: User, family: string, over: Partial<RefreshToken> = {}) =>
    tokenRepo.save(
      tokenRepo.create({
        userId: user.id,
        tokenHash: randomUUID(),
        family,
        clientType: ClientType.PWA,
        expiresAt: ahead(24 * HOUR),
        ...over,
      }),
    );

  const seedPush = (user: User, over: Partial<PushSubscription> = {}) =>
    pushRepo.save(
      pushRepo.create({
        userId: user.id,
        endpoint: `https://push.test/${randomUUID()}`,
        keys: { p256dh: 'k', auth: 'a' },
        ...over,
      }),
    );

  it('counts only usable session families and active devices', async () => {
    const user = await seedUser('anna');
    const open = randomUUID();
    await seedToken(user, open, { usedAt: ago(HOUR) }); // rotated
    await seedToken(user, open); // current token of the same family
    await seedToken(user, randomUUID(), { revokedAt: ago(HOUR) });
    await seedToken(user, randomUUID(), { expiresAt: ago(HOUR) });
    await seedPush(user, { lastUsedAt: ago(2 * HOUR) });
    await seedPush(user, { isActive: false, lastUsedAt: ago(HOUR) });

    const { data } = await service.findDevicesSummary({});

    expect(data).toHaveLength(1);
    expect(data[0]).toMatchObject({
      userId: user.id,
      email: 'anna@test.cat',
      person: { alias: 'anna', name: 'Nom anna', firstSurname: 'Cognom' },
      activeSessions: 1,
      activeDevices: 1,
      invite: null,
    });
    expect(new Date(data[0].lastPushAt!).getTime()).toBeLessThan(ago(HOUR).getTime());
    expect(data[0].lastAccessAt).not.toBeNull();
  });

  it('reports a pending or an expired invite, and none once accepted', async () => {
    const pending = await seedUser('pendent', {
      isActive: false,
      inviteToken: 'h1',
      inviteExpiresAt: ahead(HOUR),
    });
    const expired = await seedUser('caducada', {
      isActive: false,
      inviteToken: 'h2',
      inviteExpiresAt: ago(HOUR),
    });
    const accepted = await seedUser('acceptada', { inviteToken: null, inviteExpiresAt: ago(HOUR) });

    const { data } = await service.findDevicesSummary({});
    const byId = new Map(data.map((r) => [r.userId, r]));

    expect(byId.get(pending.id)!.invite?.status).toBe('PENDING');
    expect(byId.get(expired.id)!.invite?.status).toBe('EXPIRED');
    expect(byId.get(accepted.id)!.invite).toBeNull();
    expect(byId.get(pending.id)!.activeSessions).toBe(0);
    expect(byId.get(pending.id)!.lastAccessAt).toBeNull();
  });

  it('filters by search and paginates with a total', async () => {
    await seedUser('anna');
    await seedUser('bernat');
    await seedUser('carla');

    const searched = await service.findDevicesSummary({ search: 'bern' });
    expect(searched.data.map((r) => r.person?.alias)).toEqual(['bernat']);
    expect(searched.meta.total).toBe(1);

    const paged = await service.findDevicesSummary({ sortBy: 'alias', sortOrder: 'ASC', page: 2, limit: 2 });
    expect(paged.data.map((r) => r.person?.alias)).toEqual(['carla']);
    expect(paged.meta).toEqual({ total: 3, page: 2, limit: 2 });
  });

  it('sorts by most recent access by default, never-accessed last', async () => {
    const never = await seedUser('mai');
    const old = await seedUser('antic');
    const recent = await seedUser('recent');
    await seedToken(old, randomUUID(), { createdAt: ago(48 * HOUR) });
    await seedToken(recent, randomUUID());

    const { data } = await service.findDevicesSummary({});
    expect(data.map((r) => r.userId)).toEqual([recent.id, old.id, never.id]);
  });

  it.each(USER_DEVICES_SORT_BY_FIELDS)('sorts by %s without throwing', async (sortBy) => {
    await seedUser('anna');
    await expect(service.findDevicesSummary({ sortBy, sortOrder: 'DESC' })).resolves.toBeDefined();
  });
});
