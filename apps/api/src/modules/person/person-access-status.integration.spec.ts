import { DataSource } from 'typeorm';
import { AccessStatus, DelegateType, UserRole, resolveAccessStatus } from '@muixer/shared';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
} from '../../test-integration/integration-db';
import { Person } from './person.entity';
import { User } from '../user/user.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { applyAccessStatusFilter } from './utils/access-status-filter.util';

const NOW = new Date('2026-10-24T10:00:00Z');
const LATER = new Date('2026-10-30T10:00:00Z');
const EARLIER = new Date('2026-10-20T10:00:00Z');

interface Fixture {
  alias: string;
  user: { isActive: boolean; inviteExpiresAt: Date | null } | null;
  hasResponsible: boolean;
}

/** One person per status, plus the precedence corners where own account and responsible overlap. */
const FIXTURES: Fixture[] = [
  { alias: 'active', user: { isActive: true, inviteExpiresAt: null }, hasResponsible: false },
  { alias: 'active-managed', user: { isActive: true, inviteExpiresAt: null }, hasResponsible: true },
  { alias: 'invited', user: { isActive: false, inviteExpiresAt: LATER }, hasResponsible: false },
  { alias: 'invited-managed', user: { isActive: false, inviteExpiresAt: LATER }, hasResponsible: true },
  { alias: 'expired', user: { isActive: false, inviteExpiresAt: EARLIER }, hasResponsible: false },
  { alias: 'expired-at-now', user: { isActive: false, inviteExpiresAt: NOW }, hasResponsible: false },
  { alias: 'expired-managed', user: { isActive: false, inviteExpiresAt: EARLIER }, hasResponsible: true },
  { alias: 'managed', user: null, hasResponsible: true },
  { alias: 'stub-managed', user: { isActive: false, inviteExpiresAt: null }, hasResponsible: true },
  { alias: 'none', user: null, hasResponsible: false },
  { alias: 'stub-none', user: { isActive: false, inviteExpiresAt: null }, hasResponsible: false },
];

/**
 * `applyAccessStatusFilter` (SQL) must pick exactly the persons `resolveAccessStatus` (TS) gives
 * each status — the list filters on the server while each row's badge is resolved in TS.
 */
describe('Person access status filter (integration)', () => {
  let db: IntegrationDb;
  let ds: DataSource;

  beforeAll(async () => {
    db = await setupIntegrationDb();
    ds = db.dataSource;

    // A self-managed adult whose account is the one doing the managing.
    const manager = await ds.getRepository(Person).save({ name: 'Manager', firstSurname: 'T', alias: 'zz-manager' });
    const managerUser = await ds
      .getRepository(User)
      .save({ email: 'manager@test.cat', role: UserRole.MEMBER, isActive: true, person: manager });

    for (const fixture of FIXTURES) {
      const person = await ds.getRepository(Person).save({ name: fixture.alias, firstSurname: 'T', alias: fixture.alias });
      if (fixture.user) {
        await ds.getRepository(User).save({
          email: null,
          role: UserRole.MEMBER,
          isActive: fixture.user.isActive,
          inviteExpiresAt: fixture.user.inviteExpiresAt,
          person,
        });
      }
      if (fixture.hasResponsible) {
        await ds
          .getRepository(PersonDelegate)
          .save({ person, user: managerUser, delegateType: DelegateType.PARENT, isPrimary: true });
      }
    }

    // An inactive or non-primary delegate never makes anyone MANAGED.
    const notManaged = await ds.getRepository(Person).save({ name: 'x', firstSurname: 'T', alias: 'stale-delegate' });
    await ds.getRepository(PersonDelegate).save([
      { person: notManaged, user: managerUser, delegateType: DelegateType.PARENT, isPrimary: true, isActive: false },
    ]);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  const aliasesFor = async (status: AccessStatus): Promise<string[]> => {
    const qb = ds.getRepository(Person).createQueryBuilder('person').leftJoin('person.user', 'user');
    applyAccessStatusFilter(qb, status, NOW);
    const rows = await qb.orderBy('person.alias').getMany();
    return rows.map((p) => p.alias).filter((alias) => alias !== 'zz-manager');
  };

  it.each(Object.values(AccessStatus))('%s matches resolveAccessStatus', async (status) => {
    const expected = FIXTURES.filter((f) => resolveAccessStatus(f, NOW) === status)
      .map((f) => f.alias)
      .concat(status === AccessStatus.NONE ? ['stale-delegate'] : [])
      .sort();

    expect((await aliasesFor(status)).sort()).toEqual(expected);
  });
});
