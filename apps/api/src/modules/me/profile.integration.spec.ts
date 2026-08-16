import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource, Repository } from 'typeorm';
import { DelegateType, UserRole } from '@muixer/shared';
import { MeService } from './me.service';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PersonService } from '../person/person.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { Season } from '../season/season.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the new Profile-section `me` endpoints: proves the
 * "own person or isPrimary-managed person" authorization boundary against actual
 * FK-joined queries, not a mocked repository that would happily return whatever a
 * test hands it regardless of the `where` clause it was built from.
 */
describe('MeService profile endpoints (integration)', () => {
  let db: IntegrationDb;
  let service: MeService;
  let userRepo: Repository<User>;
  let personRepo: Repository<Person>;
  let delegateRepo: Repository<PersonDelegate>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        SeasonService,
        AttendanceService,
        PersonDelegateService,
        PersonService,
        ...realRepositoryProviders(db.dataSource, [
          User,
          Person,
          Tag,
          PersonDelegate,
          Event,
          Attendance,
          Season,
        ]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(MeService);
    userRepo = db.dataSource.getRepository(User);
    personRepo = db.dataSource.getRepository(Person);
    delegateRepo = db.dataSource.getRepository(PersonDelegate);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const seedPerson = async (alias: string, withUser: boolean) => {
    const person = await personRepo.save(
      personRepo.create({ name: 'Test', firstSurname: 'Person', alias }),
    );
    if (!withUser) return { person, user: null as unknown };
    const user = await userRepo.save(
      userRepo.create({ email: `${alias}@test.cat`, role: UserRole.MEMBER, isActive: true, person }),
    );
    return { person, user };
  };

  const seedDelegate = async (
    person: Person,
    user: User,
    { isPrimary }: { isPrimary: boolean },
  ) =>
    delegateRepo.save(
      delegateRepo.create({ person, user, delegateType: DelegateType.PARTNER, isPrimary }),
    );

  it('lets a user manage their own person', async () => {
    const { person, user } = await seedPerson('Marta', true);

    const summary = await service.getPersonSummary((user as User).id, person.id);

    expect(summary.personId).toBe(person.id);
    expect(summary.alias).toBe('Marta');
  });

  it('lets an active isPrimary delegate manage the person', async () => {
    const { person: childPerson } = await seedPerson('Anna', false);
    const { user: parentUser } = await seedPerson('Parent', true);
    await seedDelegate(childPerson, parentUser as User, { isPrimary: true });

    const summary = await service.getPersonSummary((parentUser as User).id, childPerson.id);

    expect(summary.personId).toBe(childPerson.id);
  });

  it('rejects a non-primary delegate from managing the person', async () => {
    const { person: childPerson } = await seedPerson('Pol', false);
    const { user: helperUser } = await seedPerson('Helper', true);
    await seedDelegate(childPerson, helperUser as User, { isPrimary: false });

    await expect(
      service.getPersonSummary((helperUser as User).id, childPerson.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects a user with no relation to the person at all', async () => {
    const { person: targetPerson } = await seedPerson('Laia', false);
    const { user: unrelatedUser } = await seedPerson('Unrelated', true);

    await expect(
      service.getPersonSummary((unrelatedUser as User).id, targetPerson.id),
    ).rejects.toThrow(ForbiddenException);
  });

  it('counts only active delegates in the person summary', async () => {
    const { person, user } = await seedPerson('Marc', true);
    const { user: activeDelegateUser } = await seedPerson('Active', true);
    const { user: inactiveDelegateUser } = await seedPerson('Inactive', true);
    await seedDelegate(person, activeDelegateUser as User, { isPrimary: false });
    const inactive = await seedDelegate(person, inactiveDelegateUser as User, { isPrimary: false });
    await delegateRepo.update(inactive.id, { isActive: false });

    const summary = await service.getPersonSummary((user as User).id, person.id);

    expect(summary.delegationCount).toBe(1);
  });

  it('creates a delegate by exact alias match, case-insensitively, and it shows up in the list', async () => {
    const { person, user } = await seedPerson('Ferran', true);
    const { user: targetUser } = await seedPerson('JoanP', true);

    const created = await service.createPersonDelegate((user as User).id, person.id, {
      alias: 'joanp',
      delegateType: DelegateType.PARTNER,
    });

    expect(created.isPrimary).toBe(false);
    expect(created.user.id).toBe((targetUser as User).id);

    const list = await service.listPersonDelegates((user as User).id, person.id);
    expect(list.map((d) => d.id)).toContain(created.id);
  });

  it('rejects creating a delegate for an alias that does not exist', async () => {
    const { person, user } = await seedPerson('Nuria', true);

    await expect(
      service.createPersonDelegate((user as User).id, person.id, {
        alias: 'NoTalAlias',
        delegateType: DelegateType.PARTNER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('rejects creating a delegate for an alias with no linked account', async () => {
    const { person, user } = await seedPerson('Oriol', true);
    await seedPerson('NoAccount', false);

    await expect(
      service.createPersonDelegate((user as User).id, person.id, {
        alias: 'NoAccount',
        delegateType: DelegateType.PARTNER,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('removes a delegate and it no longer appears in the list', async () => {
    const { person, user } = await seedPerson('Queralt', true);
    const { user: delegateUser } = await seedPerson('ToRemove', true);
    const delegate = await seedDelegate(person, delegateUser as User, { isPrimary: false });

    await service.removePersonDelegate((user as User).id, person.id, delegate.id);

    const list = await service.listPersonDelegates((user as User).id, person.id);
    expect(list.map((d) => d.id)).not.toContain(delegate.id);
  });

  it('rejects removing a primary delegate and it still appears in the list', async () => {
    const { person, user } = await seedPerson('Neus', true);
    const { user: primaryDelegateUser } = await seedPerson('PrimaryDelegate', true);
    const delegate = await seedDelegate(person, primaryDelegateUser as User, { isPrimary: true });

    await expect(
      service.removePersonDelegate((user as User).id, person.id, delegate.id),
    ).rejects.toThrow(ForbiddenException);

    const list = await service.listPersonDelegates((user as User).id, person.id);
    expect(list.map((d) => d.id)).toContain(delegate.id);
  });
});
