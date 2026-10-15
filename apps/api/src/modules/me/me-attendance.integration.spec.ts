import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AttendanceStatus, EventType, JwtPayload, NOT_REGISTERED_STATUS, UserRole } from '@muixer/shared';
import { MeService } from './me.service';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { AuditService } from '../audit/audit.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PersonService } from '../person/person.service';
import { ProjectionService } from '../event-segment/projection.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { NewsService } from '../news/news.service';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Tag } from '../tag/tag.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { Season } from '../season/season.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the member-facing side of "no row ≡ PENDENT": the attendance stats count
 * people with no answer, and a person's own attendance is always resolved — PENDENT, or
 * NO_REGISTRAT for someone created after the event day — never `null`.
 */
describe('MeService attendance (integration)', () => {
  let db: IntegrationDb;
  let service: MeService;

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
        { provide: NewsService, useValue: { findPublished: jest.fn().mockResolvedValue([]) } },
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
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(MeService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const saveEvent = () =>
    db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: '2026-05-10' as unknown as Date });

  /** Saves a person and backdates `createdAt` (TypeORM always stamps it with now() on insert). */
  const savePerson = async (alias: string, createdAt: string, overrides: Partial<Person> = {}) => {
    const person = await db.dataSource
      .getRepository(Person)
      .save({ name: 'N', firstSurname: alias, alias, ...overrides });
    await db.dataSource.query(`UPDATE persons SET "createdAt" = $1 WHERE id = $2`, [createdAt, person.id]);
    return person;
  };

  const jwtFor = async (person: Person): Promise<JwtPayload> => {
    const user = await db.dataSource
      .getRepository(User)
      .save({ email: `${person.alias}@test.cat`, isActive: true, role: UserRole.MEMBER, person });
    return { sub: user.id, email: user.email!, role: UserRole.MEMBER };
  };

  describe('getEventAttendanceStats', () => {
    it('counts PENDENT as no row or a PENDENT row, split by xicalla, without NO_REGISTRAT', async () => {
      const event = await saveEvent();
      await savePerson('ADULT', '2026-01-01T10:00:00Z');
      await savePerson('XIC', '2026-01-01T10:00:00Z', { isXicalla: true });
      const pendingRow = await savePerson('TORNAT', '2026-01-01T10:00:00Z');
      const going = await savePerson('VA', '2026-01-01T10:00:00Z');
      await savePerson('TARD', '2026-05-11T10:00:00Z');
      const attendances = db.dataSource.getRepository(Attendance);
      await attendances.save({ event, person: pendingRow, status: AttendanceStatus.PENDENT, respondedAt: new Date() });
      await attendances.save({ event, person: going, status: AttendanceStatus.ANIRE, respondedAt: new Date() });

      const stats = await service.getEventAttendanceStats(event.id);

      expect(stats.byStatus[AttendanceStatus.PENDENT]).toEqual({ adults: 2, xicalla: 1 });
      expect(stats.byStatus[AttendanceStatus.ANIRE]).toEqual({ adults: 1, xicalla: 0 });
    });
  });

  describe('own attendance', () => {
    it('is PENDENT with no id when there is no row', async () => {
      const event = await saveEvent();
      const me = await savePerson('JO', '2026-01-01T10:00:00Z');

      const detail = await service.findEventDetail(await jwtFor(me), event.id);

      expect(detail.myAttendance).toEqual({ id: null, status: AttendanceStatus.PENDENT, respondedAt: null });
      expect(detail.managedAttendances[0].attendance).toEqual(detail.myAttendance);
    });

    it('is NO_REGISTRAT for a person created after the event', async () => {
      const event = await saveEvent();
      const me = await savePerson('NOU', '2026-05-11T10:00:00Z');

      const detail = await service.findEventDetail(await jwtFor(me), event.id);

      expect(detail.myAttendance?.status).toBe(NOT_REGISTERED_STATUS);
    });

    it('returns the stored answer when there is one', async () => {
      const event = await saveEvent();
      const me = await savePerson('JO', '2026-01-01T10:00:00Z');
      const row = await db.dataSource
        .getRepository(Attendance)
        .save({ event, person: me, status: AttendanceStatus.NO_VAIG, respondedAt: new Date('2026-05-01T10:00:00Z') });

      const detail = await service.findEventDetail(await jwtFor(me), event.id);

      expect(detail.myAttendance).toEqual({
        id: row.id,
        status: AttendanceStatus.NO_VAIG,
        respondedAt: '2026-05-01T10:00:00.000Z',
      });
    });
  });
});
