import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus, AuditAction, DelegateType, EventType, TagCategory, UserRole } from '@muixer/shared';
import {
  IntegrationDb,
  realRepositoryProviders,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
} from '../../test-integration/integration-db';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { AuditLog } from '../audit/audit-log.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { CollaSettingsService } from '../colla-settings/colla-settings.service';
import { CollaSettingsStub } from '../colla-settings/colla-settings.stub';

/**
 * Permanent deletion over real Postgres: the blocker query matches the real schema, and a person
 * with only tags and delegations goes away with them (FK cascades), while attendance keeps it.
 */
describe('PersonService hardDelete (integration)', () => {
  let db: IntegrationDb;
  let service: PersonService;

  const savePerson = (alias: string, overrides: Partial<Person> = {}) =>
    db.dataSource.getRepository(Person).save({ name: 'N', firstSurname: alias, alias, ...overrides });

  const exists = async (id: string) =>
    (await db.dataSource.getRepository(Person).count({ where: { id } })) === 1;

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: CollaSettingsService, useValue: new CollaSettingsStub() },
        PersonService,
        ...realRepositoryProviders(db.dataSource, [Person, Tag]),
        { provide: PersonDelegateService, useValue: {} },
      ],
    }).compile();
    service = module.get(PersonService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
    await db.dataSource.query(`INSERT INTO "colla_settings" DEFAULT VALUES`);
  });

  it('deletes a person that only has tags and delegations, cascading both', async () => {
    const tag = await db.dataSource
      .getRepository(Tag)
      .save({ name: 'Vents', slug: 'vents', category: TagCategory.ALTRES });
    const person = await savePerson('pep', { positions: [tag] });
    const guardian = await db.dataSource
      .getRepository(User)
      .save({ email: 'g@test.cat', role: UserRole.MEMBER, isActive: true });
    await db.dataSource
      .getRepository(PersonDelegate)
      .save({ user: guardian, person, delegateType: DelegateType.PARENT });

    await expect(service.getDeletionCheck(person.id)).resolves.toEqual({
      canDelete: true,
      blockers: { assignments: 0, attendances: 0, hasUser: false, menteeCount: 0 },
    });
    await service.hardDelete(person.id, { actorUserId: guardian.id, ipAddress: '10.0.0.5' });

    expect(await exists(person.id)).toBe(false);
    const audit = await db.dataSource.getRepository(AuditLog).findOneByOrFail({ targetId: person.id });
    expect(audit).toMatchObject({ action: AuditAction.PERSON_DELETED, metadata: { alias: 'pep' } });
    expect(await db.dataSource.getRepository(PersonDelegate).count()).toBe(0);
    expect(await db.dataSource.getRepository(Tag).count({ where: { id: tag.id } })).toBe(1);
  });

  it('refuses while the person has attendance, a linked account or mentees', async () => {
    const person = await savePerson('pep');
    const event = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: '2026-01-15' as unknown as Date });
    await db.dataSource
      .getRepository(Attendance)
      .save({ event, person, status: AttendanceStatus.NO_VAIG, respondedAt: new Date() });
    await db.dataSource
      .getRepository(User)
      .save({ email: 'p@test.cat', role: UserRole.MEMBER, isActive: true, person });
    await savePerson('xic', { mentor: person });

    await expect(service.getDeletionCheck(person.id)).resolves.toEqual({
      canDelete: false,
      blockers: { assignments: 0, attendances: 1, hasUser: true, menteeCount: 1 },
    });
    await expect(
      service.hardDelete(person.id, { actorUserId: null, ipAddress: null }),
    ).rejects.toThrow(ConflictException);
    expect(await exists(person.id)).toBe(true);
    expect(await db.dataSource.getRepository(AuditLog).count()).toBe(0);
  });
});
