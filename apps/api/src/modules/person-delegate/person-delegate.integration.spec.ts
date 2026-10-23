import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { DelegateType, UserRole } from '@muixer/shared';
import { PersonDelegate } from './person-delegate.entity';
import { PersonDelegateService } from './person-delegate.service';
import { Person } from '../person/person.entity';
import { User } from '../user/user.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for `PersonDelegate`. This exists specifically to catch the class of bug
 * where an entity is wired up in its own module (`TypeOrmModule.forFeature`, satisfying DI at
 * bootstrap) but never added to `database/entities.ts` — the single source of truth for the
 * `TypeOrmModule.forRootAsync` entity list the *running app* actually uses. That gap is invisible
 * to mocked-repository unit tests (no real DataSource involved) and even to other integration
 * suites that merely inject `PersonDelegateService` without calling any of its methods: TypeORM's
 * `getRepository()` doesn't validate metadata eagerly, only on the first real query — which is
 * exactly the shape of the runtime error this suite guards against ("No metadata for
 * 'PersonDelegate' was found"). Also covers the `UQ_person_delegates_primary` partial unique index
 * (§Phase 1), which only a live database enforces.
 */
describe('PersonDelegate (integration)', () => {
  let db: IntegrationDb;
  let service: PersonDelegateService;
  let personRepo: ReturnType<DataSource['getRepository']>;
  let userRepo: ReturnType<DataSource['getRepository']>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonDelegateService,
        ...realRepositoryProviders(db.dataSource, [PersonDelegate, Person, User]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();
    service = module.get(PersonDelegateService);
    personRepo = db.dataSource.getRepository(Person);
    userRepo = db.dataSource.getRepository(User);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  it('creates a delegate end to end against real Postgres (regression: PersonDelegate must be registered in database/entities.ts)', async () => {
    const child = await personRepo.save(
      personRepo.create({ name: 'Child', firstSurname: 'Surname', alias: 'child1', isXicallaManual: true }),
    );
    const parentUser = await userRepo.save(
      userRepo.create({ email: 'parent@test.cat', role: UserRole.MEMBER, isActive: true }),
    );

    const created = await service.create(child.id, {
      userId: parentUser.id,
      delegateType: DelegateType.PARENT,
    });

    expect(created.id).toBeDefined();

    const found = await service.findByPerson(child.id);
    expect(found).toHaveLength(1);
    expect(found[0].user.email).toBe('parent@test.cat');
  });

  it('judges the primary manager of a xicalla by the effective value of the other persons they manage', async () => {
    const child = await personRepo.save(
      personRepo.create({ name: 'Child', firstSurname: 'Surname', alias: 'child4', birthDate: '2020-01-01' as never }),
    );
    // Flagged xicalla by hand, but the birth date says adult: the date wins.
    const adultByDate = await personRepo.save(
      personRepo.create({ name: 'Gran', firstSurname: 'Surname', alias: 'gran4', birthDate: '1980-01-01' as never, isXicallaManual: true }),
    );
    // Not flagged, but the birth date says xicalla.
    const kidByDate = await personRepo.save(
      personRepo.create({ name: 'Petit', firstSurname: 'Surname', alias: 'petit4', birthDate: '2018-01-01' as never }),
    );
    const qualifies = await userRepo.save(userRepo.create({ email: 'q@test.cat', role: UserRole.MEMBER, isActive: true }));
    const doesNot = await userRepo.save(userRepo.create({ email: 'n@test.cat', role: UserRole.MEMBER, isActive: true }));
    await service.create(adultByDate.id, { userId: qualifies.id, delegateType: DelegateType.OTHER });
    await service.create(kidByDate.id, { userId: doesNot.id, delegateType: DelegateType.PARENT });

    await expect(
      service.create(child.id, { userId: doesNot.id, delegateType: DelegateType.PARENT, isPrimary: true }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.create(child.id, { userId: qualifies.id, delegateType: DelegateType.PARENT, isPrimary: true }),
    ).resolves.toMatchObject({ isPrimary: true });
  });

  it('the partial unique index allows only one isPrimary=true row per person', async () => {
    const child = await personRepo.save(
      personRepo.create({ name: 'Child', firstSurname: 'Surname', alias: 'child2', isXicallaManual: true }),
    );
    const parent = await userRepo.save(
      userRepo.create({ email: 'parent2@test.cat', role: UserRole.MEMBER, isActive: true }),
    );
    const other = await userRepo.save(
      userRepo.create({ email: 'other@test.cat', role: UserRole.MEMBER, isActive: true }),
    );

    await expect(
      db.dataSource.query(
        `INSERT INTO "person_delegates" ("user_id", "person_id", "delegateType", "isPrimary", "isActive")
         VALUES ($1, $2, 'PARENT', true, true), ($3, $2, 'GUARDIAN', true, true)`,
        [parent.id, child.id, other.id],
      ),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('create() with isPrimary demotes the previous primary atomically', async () => {
    // Not a Xicalla person here on purpose — this test exercises the isPrimary swap
    // mechanic in isolation, not Phase 3's "qualifying adult manager" rule.
    const person = await personRepo.save(
      personRepo.create({ name: 'Adult', firstSurname: 'Surname', alias: 'adult3', isXicallaManual: false }),
    );
    const firstParent = await userRepo.save(
      userRepo.create({ email: 'first-parent@test.cat', role: UserRole.MEMBER, isActive: true }),
    );
    const secondParent = await userRepo.save(
      userRepo.create({ email: 'second-parent@test.cat', role: UserRole.MEMBER, isActive: true }),
    );

    const first = await service.create(person.id, {
      userId: firstParent.id,
      delegateType: DelegateType.PARENT,
      isPrimary: true,
    });
    expect(first.isPrimary).toBe(true);

    await service.create(person.id, {
      userId: secondParent.id,
      delegateType: DelegateType.GUARDIAN,
      isPrimary: true,
    });

    const delegates = await service.findByPerson(person.id);
    const primaries = delegates.filter((d) => d.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].user.email).toBe('second-parent@test.cat');
  });
});
