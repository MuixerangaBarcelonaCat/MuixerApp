// See src/test-integration/integration-db.ts — Ryuk's socket ping fails on rootless/SELinux Docker.
process.env.TESTCONTAINERS_RYUK_DISABLED = process.env.TESTCONTAINERS_RYUK_DISABLED ?? 'true';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';
import { DelegateType } from '@muixer/shared';
import { ENTITIES } from '../modules/database/entities';
import { Person } from '../modules/person/person.entity';
import { PersonDelegate } from '../modules/person-delegate/person-delegate.entity';
import { User } from '../modules/user/user.entity';
import { migrations } from './index';

/**
 * Proves the PARTNER removal migration: runs every migration *before* `RemovePartnerDelegateType`,
 * seeds one PARTNER and one PARENT delegate, then runs the migration and asserts PARTNER rows
 * became OTHER and the value is gone from `delegate_type_enum`.
 */
describe('RemovePartnerDelegateType (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  const TARGET = 'RemovePartnerDelegateType1785900000000';
  const targetIndex = migrations.findIndex((m) => m.name === TARGET);
  const before = migrations.slice(0, targetIndex);
  const upToTarget = migrations.slice(0, targetIndex + 1);

  const dataSourceFor = (list: typeof migrations) =>
    new DataSource({
      type: 'postgres',
      url: container.getConnectionUri(),
      entities: ENTITIES,
      migrations: list,
      migrationsTableName: 'typeorm_migrations',
      synchronize: false,
      logging: false,
    });

  beforeAll(async () => {
    expect(targetIndex).toBeGreaterThan(-1);
    container = await new PostgreSqlContainer('postgres:16-alpine').start();

    const pre = dataSourceFor(before);
    await pre.initialize();
    await pre.runMigrations();

    const user = await pre.getRepository(User).save({ email: 'delegate@test.com', passwordHash: 'x' });
    const personRepo = pre.getRepository(Person);
    const partner = await personRepo.save({ name: 'Partner', firstSurname: 'A', alias: 'partner' });
    const child = await personRepo.save({ name: 'Child', firstSurname: 'B', alias: 'child' });
    const delegateRepo = pre.getRepository(PersonDelegate);
    // PARTNER no longer exists at HEAD, so the cast forces the legacy value in.
    await delegateRepo.save({ user, person: partner, delegateType: 'PARTNER' as DelegateType });
    await delegateRepo.save({ user, person: child, delegateType: DelegateType.PARENT });
    await pre.destroy();

    dataSource = dataSourceFor(upToTarget);
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 180_000);

  afterAll(async () => {
    if (dataSource?.isInitialized) await dataSource.destroy();
    await container?.stop();
  });

  it('turns existing PARTNER delegates into OTHER and leaves the rest alone', async () => {
    const rows: { alias: string; delegateType: string }[] = await dataSource.query(
      `SELECT p."alias", d."delegateType" FROM "person_delegates" d
         JOIN "persons" p ON p."id" = d."person_id" ORDER BY p."alias"`,
    );
    expect(rows).toEqual([
      { alias: 'child', delegateType: 'PARENT' },
      { alias: 'partner', delegateType: 'OTHER' },
    ]);
  });

  it('drops PARTNER from delegate_type_enum', async () => {
    const values: { enumlabel: string }[] = await dataSource.query(
      `SELECT enumlabel FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
        WHERE t.typname = 'delegate_type_enum' ORDER BY enumlabel`,
    );
    expect(values.map((v) => v.enumlabel)).toEqual(['GUARDIAN', 'OTHER', 'PARENT']);
  });
});
