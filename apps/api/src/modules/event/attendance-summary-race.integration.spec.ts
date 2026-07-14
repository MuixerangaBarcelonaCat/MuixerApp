import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, AttendanceStatus } from '@muixer/shared';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../test-integration/integration-db';

/**
 * Real-Postgres regression suite for the ARCH-8 attendance-summary race: `recalculateSummary` used
 * to read all attendances, compute counts in memory, then write them back with no lock — two
 * concurrent create/update/remove calls for the same event could interleave so the slower one's write
 * clobbered the faster one's with a stale count. A mocked-repository unit test can assert the lock is
 * *requested*, but only a real Postgres instance can prove concurrent transactions actually serialize
 * on it instead of losing an update. See TEST-2 in docs/automated-analyses/01-full-repo-audit.md.
 */
describe('AttendanceService summary race (integration)', () => {
  let db: IntegrationDb;
  let service: AttendanceService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        ...realRepositoryProviders(db.dataSource, [Attendance, Event, Person]),
        { provide: DataSource, useValue: db.dataSource },
      ],
    }).compile();

    service = module.get(AttendanceService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  it('never loses an update when many attendance changes race on the same event', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const personRepo = db.dataSource.getRepository(Person);

    const event = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: 'Assaig concurrència',
      date: new Date('2026-01-01'),
    });

    const personCount = 10;
    const persons = await Promise.all(
      Array.from({ length: personCount }, (_, i) =>
        personRepo.save({ name: 'P', firstSurname: `${i}`, alias: `race-${i}` }),
      ),
    );

    await Promise.all(
      persons.map((person) =>
        service.create(event.id, { personId: person.id, status: AttendanceStatus.ANIRE }),
      ),
    );

    const finalEvent = await eventRepo.findOne({ where: { id: event.id } });

    // Every concurrent create must be reflected — none silently overwritten by a racing recalculation.
    expect(finalEvent!.attendanceSummary.total).toBe(personCount);
    expect(finalEvent!.attendanceSummary.confirmed).toBe(personCount);
  });
});
