import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
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
import { ProjectionService } from '../event-segment/projection.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the `me` module's pending-dependents endpoints: proves the
 * authorization boundary (a user can only see/complete xicalla where *they* are the primary
 * delegate) against actual FK-joined queries, not a mocked repository that would happily return
 * whatever a test hands it regardless of the `where` clause it was built from.
 */
describe('MeService pending dependents (integration)', () => {
  let db: IntegrationDb;
  let service: MeService;
  let userRepo: ReturnType<DataSource['getRepository']>;
  let personRepo: ReturnType<DataSource['getRepository']>;
  let delegateRepo: ReturnType<DataSource['getRepository']>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MeService,
        SeasonService,
        AttendanceService,
        PersonDelegateService,
        PersonService,
        { provide: ProjectionService, useValue: { getProjection: jest.fn() } },
        { provide: EventSegmentService, useValue: { findAllByEvent: jest.fn() } },
        ...realRepositoryProviders(db.dataSource, [
          User,
          Person,
          Tag,
          PersonDelegate,
          Event,
          Attendance,
          Season,
          NodeAssignment,
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

  const seedParentWithDependent = async (parentAlias: string, childAlias: string) => {
    const parentPerson = await personRepo.save(
      personRepo.create({ name: 'Parent', firstSurname: 'Test', alias: parentAlias }),
    );
    const parentUser = await userRepo.save(
      userRepo.create({ email: `${parentAlias}@test.cat`, role: UserRole.MEMBER, isActive: true, person: parentPerson }),
    );
    const childPerson = await personRepo.save(
      personRepo.create({
        name: 'Provisional',
        firstSurname: '',
        alias: `~${childAlias}`,
        isProvisional: true,
        isXicalla: true,
      }),
    );
    await delegateRepo.save(
      delegateRepo.create({
        person: childPerson,
        user: parentUser,
        delegateType: DelegateType.PARENT,
        isPrimary: true,
      }),
    );
    return { parentUser, childPerson };
  };

  it('only returns pending dependents for the requesting user, not another primary delegate\'s', async () => {
    const { parentUser: parentA, childPerson: childA } = await seedParentWithDependent('parentA', 'childA');
    const { parentUser: parentB } = await seedParentWithDependent('parentB', 'childB');

    const resultA = await service.getPendingDependents(parentA.id);

    expect(resultA).toHaveLength(1);
    expect(resultA[0].personId).toBe(childA.id);

    const resultB = await service.getPendingDependents(parentB.id);
    expect(resultB.map((d) => d.personId)).not.toContain(childA.id);
  });

  it('promotes the dependent and strips the provisional alias prefix on completion', async () => {
    const { parentUser, childPerson } = await seedParentWithDependent('parentC', 'childC');

    await service.completePendingDependent(parentUser.id, {
      personId: childPerson.id,
      name: 'Xicalla',
      firstSurname: 'Completa',
      gender: 'FEMALE',
      phone: '+34612345679',
      birthDate: '2016-03-10',
    } as never);

    const reloaded = await personRepo.findOne({ where: { id: childPerson.id } });
    expect(reloaded?.isProvisional).toBe(false);
    expect(reloaded?.alias).toBe('childC');
    expect(reloaded?.name).toBe('Xicalla');

    const remaining = await service.getPendingDependents(parentUser.id);
    expect(remaining).toHaveLength(0);
  });

  it('rejects completing a dependent that belongs to a different primary delegate', async () => {
    const { childPerson: childA } = await seedParentWithDependent('parentD', 'childD');
    const { parentUser: parentB } = await seedParentWithDependent('parentE', 'childE');

    await expect(
      service.completePendingDependent(parentB.id, {
        personId: childA.id,
        name: 'Hijacked',
        firstSurname: 'Attempt',
        gender: 'MALE',
        phone: '+34612345680',
        birthDate: '2016-01-01',
      } as never),
    ).rejects.toThrow(BadRequestException);

    const reloaded = await personRepo.findOne({ where: { id: childA.id } });
    expect(reloaded?.isProvisional).toBe(true);
  });
});
