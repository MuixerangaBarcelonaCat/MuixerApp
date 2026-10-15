import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { EventType, SEASON_LEAVES_EVENTS_UNCOVERED } from '@muixer/shared';
import { SeasonService } from './season.service';
import { Season } from './season.entity';
import { Event } from '../event/event.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres coverage for seasons as non-overlapping date ranges: the exclusion/check constraints
 * and every query that places an event in a season by its date only mean something against real SQL.
 */
describe('SeasonService (integration)', () => {
  let db: IntegrationDb;
  let service: SeasonService;

  beforeAll(async () => {
    db = await setupIntegrationDb();
    const module: TestingModule = await Test.createTestingModule({
      providers: [SeasonService, ...realRepositoryProviders(db.dataSource, [Season, Event])],
    }).compile();
    service = module.get(SeasonService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const insertSeason = (name: string, startDate: string, endDate: string) =>
    db.dataSource.query(
      `INSERT INTO "seasons" ("name", "startDate", "endDate") VALUES ($1, $2, $3) RETURNING "id"`,
      [name, startDate, endDate],
    );

  const insertEvent = (date: string, eventType = EventType.ASSAIG) =>
    db.dataSource.getRepository(Event).save({ eventType, title: `Esdeveniment ${date}`, date });

  describe('constraints', () => {
    it('rejects an overlapping season at the database level', async () => {
      await insertSeason('A', '2025-09-06', '2026-09-05');
      await expect(insertSeason('B', '2026-09-05', '2027-09-05')).rejects.toMatchObject({ code: '23P01' });
    });

    it('allows adjacent seasons (inclusive ranges that only touch day to day)', async () => {
      await insertSeason('A', '2025-09-06', '2026-09-05');
      await expect(insertSeason('B', '2026-09-06', '2027-09-05')).resolves.toBeDefined();
    });

    it('rejects a season whose end is not after its start', async () => {
      await expect(insertSeason('A', '2026-09-05', '2026-09-05')).rejects.toMatchObject({ code: '23514' });
    });
  });

  describe('placing events in seasons by date', () => {
    beforeEach(async () => {
      await insertSeason('2025-2026', '2025-09-06', '2026-09-05');
      await insertSeason('2026-2027', '2026-09-06', '2027-09-05');
    });

    it('counts events per season by date range, inclusive at both ends', async () => {
      await insertEvent('2025-09-06');
      await insertEvent('2026-09-05');
      await insertEvent('2026-09-06');
      await insertEvent('2024-01-01');

      const { data } = await service.findAll();
      const byName = Object.fromEntries(data.map((s) => [s.name, s.eventCount]));
      expect(byName).toEqual({ '2025-2026': 2, '2026-2027': 1 });
    });

    it('splits each season count into rehearsals and performances', async () => {
      await insertEvent('2025-10-01');
      await insertEvent('2025-11-01');
      await insertEvent('2026-06-24', EventType.ACTUACIO);

      const { data } = await service.findAll();
      expect(data.find((s) => s.name === '2025-2026')).toMatchObject({
        eventCount: 3,
        rehearsalCount: 2,
        performanceCount: 1,
      });
      expect(data.find((s) => s.name === '2026-2027')).toMatchObject({
        eventCount: 0,
        rehearsalCount: 0,
        performanceCount: 0,
      });
    });

    it('finds the season containing a date, at both edges', async () => {
      await expect(service.findByDate('2026-09-05')).resolves.toMatchObject({ name: '2025-2026' });
      await expect(service.findByDate('2026-09-06')).resolves.toMatchObject({ name: '2026-2027' });
      await expect(service.findByDate('2025-09-05')).resolves.toBeNull();
    });

    it('counts events whose date is in no season', async () => {
      await insertEvent('2025-09-05');
      await insertEvent('2027-09-06');
      await insertEvent('2026-01-10');
      await expect(service.countUncoveredEvents()).resolves.toEqual({ count: 2 });
    });
  });

  describe('edits that would leave events without a season', () => {
    let a: string;
    let b: string;

    beforeEach(async () => {
      [{ id: a }] = await insertSeason('A', '2025-09-06', '2026-09-05');
      [{ id: b }] = await insertSeason('B', '2026-09-06', '2027-09-05');
      await insertEvent('2026-09-07');
      await insertEvent('2026-09-08');
    });

    it('blocks shrinking B past its events, reporting how many would be left out', async () => {
      const err = await service.update(b, { startDate: '2026-09-10' }).catch((e) => e);
      expect(err).toBeInstanceOf(ConflictException);
      expect(err.getResponse()).toMatchObject({ code: SEASON_LEAVES_EVENTS_UNCOVERED, uncoveredCount: 2 });
    });

    it('moves the A/B boundary in two confirmed steps: shrink B, then extend A', async () => {
      await service.update(b, { startDate: '2026-09-10' }, { allowUncovered: true });
      await expect(service.countUncoveredEvents()).resolves.toEqual({ count: 2 });

      await service.update(a, { endDate: '2026-09-09' });
      await expect(service.countUncoveredEvents()).resolves.toEqual({ count: 0 });
      await expect(service.findOne(a)).resolves.toMatchObject({ eventCount: 2 });
    });

    it('blocks deleting a season with events unless confirmed', async () => {
      await expect(service.remove(b)).rejects.toThrow(ConflictException);
      await service.remove(b, { allowUncovered: true });
      await expect(service.countUncoveredEvents()).resolves.toEqual({ count: 2 });
    });
  });
});
