import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventType } from '@muixer/shared';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { AuditService } from '../audit/audit.service';
import { SeasonService } from '../season/season.service';
import { Event } from './event.entity';
import { Season } from '../season/season.entity';
import { Attendance } from './attendance.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Person } from '../person/person.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres coverage for an event's season being derived from its date (never stored): the
 * date-range join, the `seasonId` filter on it, and the create/update rule that a new or moved date
 * must fall inside a season.
 */
describe('EventService — season derived from date (integration)', () => {
  let db: IntegrationDb;
  let service: EventService;

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventService,
        AttendanceService,
        SeasonService,
        ...realRepositoryProviders(db.dataSource, [Event, Season, Attendance, EventSegment, Person]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();
    service = module.get(EventService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  let a: string;
  let b: string;

  beforeEach(async () => {
    [{ id: a }] = await db.dataSource.query(
      `INSERT INTO "seasons" (name, "startDate", "endDate") VALUES ('2025-2026', '2025-09-06', '2026-09-05') RETURNING "id"`,
    );
    [{ id: b }] = await db.dataSource.query(
      `INSERT INTO "seasons" (name, "startDate", "endDate") VALUES ('2026-2027', '2026-09-06', '2027-09-05') RETURNING "id"`,
    );
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const insertEvent = (title: string, date: string) =>
    db.dataSource.getRepository(Event).save({ eventType: EventType.ASSAIG, title, date });

  it('lists each event with the season containing its date, null outside every season', async () => {
    await insertEvent('last-day-a', '2026-09-05');
    await insertEvent('first-day-b', '2026-09-06');
    await insertEvent('uncovered', '2024-01-01');

    const { data } = await service.findAll({ limit: 100 });
    const byTitle = Object.fromEntries(data.map((e) => [e.title, e.season?.name ?? null]));
    expect(byTitle).toEqual({ 'last-day-a': '2025-2026', 'first-day-b': '2026-2027', uncovered: null });
  });

  it('filters by seasonId through the date range, paginating correctly', async () => {
    for (let i = 1; i <= 3; i++) await insertEvent(`a${i}`, `2026-0${i}-10`);
    await insertEvent('b1', '2026-10-10');

    const page = await service.findAll({ seasonId: a, page: 1, limit: 2, sortBy: 'date', sortOrder: 'ASC' });
    expect(page.total).toBe(3);
    expect(page.data.map((e) => e.title)).toEqual(['a1', 'a2']);
    expect((await service.findAll({ seasonId: b })).data.map((e) => e.title)).toEqual(['b1']);
  });

  it('returns the derived season on the detail', async () => {
    const ev = await insertEvent('detail', '2026-10-10');
    await expect(service.findOne(ev.id)).resolves.toMatchObject({ season: { id: b, name: '2026-2027' } });
  });

  it('creates an event inside a season and rejects one outside every season', async () => {
    const created = await service.create({ title: 'Nou', eventType: EventType.ASSAIG, date: '2026-09-06' });
    expect(created.season).toEqual({ id: b, name: '2026-2027' });
    expect(String(created.date)).toBe('2026-09-06');

    await expect(
      service.create({ title: 'Fora', eventType: EventType.ASSAIG, date: '2027-09-06' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('keeps an uncovered event editable while its date is unchanged, but rejects moving it outside', async () => {
    const ev = await insertEvent('antic', '2024-01-01');

    const renamed = await service.update(ev.id, { title: 'antic (revisat)', date: '2024-01-01' });
    expect(renamed).toMatchObject({ title: 'antic (revisat)', season: null });

    await expect(service.update(ev.id, { date: '2024-02-01' })).rejects.toThrow(BadRequestException);
    const moved = await service.update(ev.id, { date: '2025-10-01' });
    expect(moved.season).toEqual({ id: a, name: '2025-2026' });
  });
});
