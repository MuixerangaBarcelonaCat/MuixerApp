import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, AttendanceStatus, NOT_REGISTERED_STATUS } from '@muixer/shared';
import { AttendanceService } from './attendance.service';
import { AuditService } from '../audit/audit.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { DeleteEmptyPendingAttendances1785800000000 } from '../../migrations/1785800000000-DeleteEmptyPendingAttendances';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres suite for the "no row ≡ PENDENT" model: a person with no attendance row (or a
 * PENDENT one) is Pendent if they existed on the event day (Europe/Madrid) and NO_REGISTRAT —
 * left out of every event-level list and count — if they were created afterwards. Only real SQL
 * proves the LEFT JOIN population, the status filter and the timezone boundary.
 */
describe('AttendanceService pending model (integration)', () => {
  let db: IntegrationDb;
  let service: AttendanceService;

  const EVENT_DATE = '2026-05-10';

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        ...realRepositoryProviders(db.dataSource, [Attendance, Event, Person]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  const originalLockDays = process.env.ASSIGNMENT_LOCK_DAYS;

  afterEach(async () => {
    process.env.ASSIGNMENT_LOCK_DAYS = originalLockDays;
    await truncateAllTables(db.dataSource);
  });

  const saveEvent = (date = EVENT_DATE) =>
    db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: date as unknown as Date,
    });

  /** Saves a person and backdates `createdAt` (TypeORM always stamps it with now() on insert). */
  const savePerson = async (alias: string, createdAt: string, overrides: Partial<Person> = {}) => {
    const person = await db.dataSource
      .getRepository(Person)
      .save({ name: 'N', firstSurname: alias, alias, ...overrides });
    await db.dataSource.query(`UPDATE persons SET "createdAt" = $1 WHERE id = $2`, [createdAt, person.id]);
    return person;
  };

  const saveRow = (event: Event, person: Person, status: AttendanceStatus, respondedAt: Date | null = new Date()) =>
    db.dataSource.getRepository(Attendance).save({ event, person, status, respondedAt });

  const rowCount = () => db.dataSource.getRepository(Attendance).count();

  describe('findByEvent', () => {
    it('lists a person with no row as PENDENT, with no attendance data', async () => {
      const event = await saveEvent();
      const person = await savePerson('ANNA', '2026-01-01T10:00:00Z');

      const { data, total } = await service.findByEvent(event.id, {});

      expect(total).toBe(1);
      expect(data[0]).toEqual(
        expect.objectContaining({ status: AttendanceStatus.PENDENT, respondedAt: null, notes: null }),
      );
      expect(data[0].person.id).toBe(person.id);
    });

    it('includes inactive persons', async () => {
      const event = await saveEvent();
      await savePerson('INACTIU', '2026-01-01T10:00:00Z', { isActive: false });

      const { total } = await service.findByEvent(event.id, {});

      expect(total).toBe(1);
    });

    it('leaves out a person created after the event with no answer (NO_REGISTRAT)', async () => {
      const event = await saveEvent();
      const late = await savePerson('TARDA', '2026-05-11T10:00:00Z');
      await savePerson('LATER2', '2026-06-01T10:00:00Z');
      await saveRow(event, late, AttendanceStatus.PENDENT);

      const { total } = await service.findByEvent(event.id, {});

      expect(total).toBe(0);
    });

    it('keeps a person created after the event when they have an answered row', async () => {
      const event = await saveEvent();
      const late = await savePerson('TARDA', '2026-05-11T10:00:00Z');
      await saveRow(event, late, AttendanceStatus.ASSISTIT);

      const { data } = await service.findByEvent(event.id, {});

      expect(data.map((d) => d.status)).toEqual([AttendanceStatus.ASSISTIT]);
    });

    it('counts a person created on the event day in Madrid (but the day before in UTC) as PENDENT', async () => {
      const event = await saveEvent();
      await savePerson('MATINER', '2026-05-09T23:30:00Z');

      const { data } = await service.findByEvent(event.id, {});

      expect(data.map((d) => d.status)).toEqual([AttendanceStatus.PENDENT]);
    });

    it('filters PENDENT as "no row or a PENDENT row"', async () => {
      const event = await saveEvent();
      const a = await savePerson('AAA', '2026-01-01T10:00:00Z');
      const b = await savePerson('BBB', '2026-01-01T10:00:00Z');
      const c = await savePerson('CCC', '2026-01-01T10:00:00Z');
      await saveRow(event, a, AttendanceStatus.PENDENT);
      await saveRow(event, b, AttendanceStatus.ANIRE);

      const { data, total } = await service.findByEvent(event.id, { status: AttendanceStatus.PENDENT });

      expect(total).toBe(2);
      expect(data.map((d) => d.person.id).sort()).toEqual([a.id, c.id].sort());
    });

    it('filters an answered status by its rows only', async () => {
      const event = await saveEvent();
      const a = await savePerson('AAA', '2026-01-01T10:00:00Z');
      await savePerson('BBB', '2026-01-01T10:00:00Z');
      await saveRow(event, a, AttendanceStatus.ANIRE);

      const { data } = await service.findByEvent(event.id, { status: AttendanceStatus.ANIRE });

      expect(data.map((d) => d.person.id)).toEqual([a.id]);
    });

    it('only joins rows of the requested event', async () => {
      const event = await saveEvent();
      const other = await saveEvent('2026-05-17');
      const a = await savePerson('AAA', '2026-01-01T10:00:00Z');
      await saveRow(other, a, AttendanceStatus.ASSISTIT);

      const { data } = await service.findByEvent(event.id, {});

      expect(data.map((d) => d.status)).toEqual([AttendanceStatus.PENDENT]);
    });
  });

  describe('set', () => {
    it('writes nothing when setting PENDENT on a person with no row', async () => {
      const event = await saveEvent('2099-01-01');
      const person = await savePerson('ANNA', '2026-01-01T10:00:00Z');

      const { attendance } = await service.set(event.id, person.id, { status: AttendanceStatus.PENDENT });

      expect(attendance.status).toBe(AttendanceStatus.PENDENT);
      expect(await rowCount()).toBe(0);
    });

    it('inserts a row with respondedAt when an answer is given', async () => {
      const event = await saveEvent('2099-01-01');
      const person = await savePerson('ANNA', '2026-01-01T10:00:00Z');

      const { attendance } = await service.set(event.id, person.id, { status: AttendanceStatus.ANIRE });

      expect(attendance.status).toBe(AttendanceStatus.ANIRE);
      expect(attendance.respondedAt).not.toBeNull();
      expect(await rowCount()).toBe(1);
    });

    it('inserts a PENDENT row without respondedAt when only a note is added', async () => {
      const event = await saveEvent('2099-01-01');
      const person = await savePerson('ANNA', '2026-01-01T10:00:00Z');

      await service.set(event.id, person.id, { notes: 'Lesionada' });

      const row = await db.dataSource.getRepository(Attendance).findOneOrFail({ where: { person: { id: person.id } } });
      expect(row.status).toBe(AttendanceStatus.PENDENT);
      expect(row.respondedAt).toBeNull();
      expect(row.notes).toBe('Lesionada');
    });

    it('keeps the row and bumps respondedAt when an answer goes back to PENDENT', async () => {
      const event = await saveEvent('2099-01-01');
      const person = await savePerson('ANNA', '2026-01-01T10:00:00Z');
      const original = new Date('2026-01-02T10:00:00Z');
      await saveRow(event, person, AttendanceStatus.ANIRE, original);

      await service.set(event.id, person.id, { status: AttendanceStatus.PENDENT });

      const row = await db.dataSource.getRepository(Attendance).findOneOrFail({ where: { person: { id: person.id } } });
      expect(row.status).toBe(AttendanceStatus.PENDENT);
      expect(row.respondedAt!.getTime()).toBeGreaterThan(original.getTime());
    });

    it('returns NO_REGISTRAT for a no-op on a person created after the event', async () => {
      const event = await saveEvent();
      const late = await savePerson('TARDA', '2026-05-11T10:00:00Z');
      process.env.ASSIGNMENT_LOCK_DAYS = '0';

      const { attendance } = await service.set(event.id, late.id, {});

      expect(attendance.status).toBe(NOT_REGISTERED_STATUS);
    });
  });

  describe('summary', () => {
    it('counts pending as persons who existed at the event with no row or a PENDENT row', async () => {
      const event = await saveEvent('2099-01-01');
      const a = await savePerson('AAA', '2026-01-01T10:00:00Z');
      const b = await savePerson('BBB', '2026-01-01T10:00:00Z');
      await savePerson('CCC', '2026-01-01T10:00:00Z');
      await saveRow(event, a, AttendanceStatus.PENDENT);
      await saveRow(event, b, AttendanceStatus.ANIRE);

      const summary = await service.recalculateSummary(event.id);

      expect(summary.pending).toBe(2);
      expect(summary.confirmed).toBe(1);
      expect(summary.total).toBe(3);
    });

    it('leaves NO_REGISTRAT persons out of pending and total', async () => {
      const event = await saveEvent();
      const late = await savePerson('TARDA', '2026-05-11T10:00:00Z');
      await saveRow(event, late, AttendanceStatus.PENDENT);

      const summary = await service.recalculateSummary(event.id);

      expect(summary.pending).toBe(0);
      expect(summary.total).toBe(0);
    });

    it('livePendingCounts reflects persons created after the summary was stored', async () => {
      const event = await saveEvent('2099-01-01');
      const other = await saveEvent('2099-02-01');
      await savePerson('AAA', '2026-01-01T10:00:00Z');
      await service.recalculateSummary(event.id);
      await savePerson('BBB', '2026-01-01T10:00:00Z');

      const counts = await service.livePendingCounts([event.id, other.id]);

      expect(counts.get(event.id)).toBe(2);
      expect(counts.get(other.id)).toBe(2);
    });
  });

  describe('DeleteEmptyPendingAttendances migration', () => {
    it('deletes only PENDENT rows with neither respondedAt nor notes', async () => {
      const event = await saveEvent();
      const empty = await savePerson('BUIT', '2026-01-01T10:00:00Z');
      const answered = await savePerson('TORNAT', '2026-01-01T10:00:00Z');
      const noted = await savePerson('NOTA', '2026-01-01T10:00:00Z');
      const going = await savePerson('VA', '2026-01-01T10:00:00Z');
      await saveRow(event, empty, AttendanceStatus.PENDENT, null);
      await saveRow(event, answered, AttendanceStatus.PENDENT, new Date());
      await db.dataSource
        .getRepository(Attendance)
        .save({ event, person: noted, status: AttendanceStatus.PENDENT, respondedAt: null, notes: 'Lesionada' });
      await saveRow(event, going, AttendanceStatus.ANIRE, null);

      const queryRunner = db.dataSource.createQueryRunner();
      await new DeleteEmptyPendingAttendances1785800000000().up(queryRunner);
      await queryRunner.release();

      const remaining = await db.dataSource.getRepository(Attendance).find({ relations: ['person'] });
      expect(remaining.map((a) => a.person.alias).sort()).toEqual(['NOTA', 'TORNAT', 'VA']);
    });
  });
});
