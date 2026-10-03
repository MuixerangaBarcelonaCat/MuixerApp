import { Test, TestingModule } from '@nestjs/testing';
import { Subscriber } from 'rxjs';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { AttendanceSyncStrategy } from './attendance-sync.strategy';
import { LegacyApiClient } from '../legacy-api.client';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { XlsxAttendanceRow } from '../interfaces/legacy-event.interface';
import { Attendance } from '../../event/attendance.entity';
import { Event } from '../../event/event.entity';
import { Person } from '../../person/person.entity';
import {
  IntegrationDb,
  setupIntegrationDb,
  teardownIntegrationDb,
  truncateAllTables,
  realRepositoryProviders,
} from '../../../test-integration/integration-db';

/**
 * Real-Postgres suite for how the legacy attendance sync writes "no answer": it never creates a
 * PENDENT row (no row ≡ PENDENT), but an answer cleared in the legacy app must clear the local one.
 */
describe('AttendanceSyncStrategy (integration)', () => {
  let db: IntegrationDb;
  let strategy: AttendanceSyncStrategy;
  const legacyApiClient = { getAssistenciesXlsx: jest.fn() };
  const subscriber = { next: jest.fn() } as unknown as Subscriber<SyncEvent>;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceSyncStrategy,
        ...realRepositoryProviders(db.dataSource, [Attendance, Event, Person]),
        { provide: LegacyApiClient, useValue: legacyApiClient },
      ],
    }).compile();

    strategy = module.get(AttendanceSyncStrategy);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  const saveEvent = () =>
    db.dataSource.getRepository(Event).save({
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: '2099-05-10' as unknown as Date,
      legacyId: '42',
    });

  const savePerson = (legacyId: string) =>
    db.dataSource.getRepository(Person).save({ name: 'N', firstSurname: legacyId, alias: `P${legacyId}`, legacyId });

  const row = (legacyPersonId: string, overrides: Partial<XlsxAttendanceRow> = {}): XlsxAttendanceRow => ({
    legacyPersonId,
    personLabel: legacyPersonId,
    notes: null,
    estat: null,
    instant: null,
    ...overrides,
  });

  const findRow = (event: Event, person: Person) =>
    db.dataSource.getRepository(Attendance).findOne({
      where: { event: { id: event.id }, person: { id: person.id } },
    });

  it('resets a local answer to PENDENT when the legacy answer was cleared, keeping its notes', async () => {
    const event = await saveEvent();
    const person = await savePerson('100');
    await db.dataSource.getRepository(Attendance).save({
      event,
      person,
      status: AttendanceStatus.ANIRE,
      respondedAt: new Date('2099-05-01T10:00:00Z'),
      notes: 'Arribarà tard',
    });
    legacyApiClient.getAssistenciesXlsx.mockResolvedValue([row('100')]);

    await strategy.syncAll(subscriber, [event]);

    const saved = await findRow(event, person);
    expect(saved).toMatchObject({ status: AttendanceStatus.PENDENT, respondedAt: null, notes: 'Arribarà tard' });
  });

  it('still creates no row for someone who never answered', async () => {
    const event = await saveEvent();
    const person = await savePerson('100');
    legacyApiClient.getAssistenciesXlsx.mockResolvedValue([row('100')]);

    await strategy.syncAll(subscriber, [event]);

    expect(await findRow(event, person)).toBeNull();
  });

  it('leaves other events untouched', async () => {
    const event = await saveEvent();
    const other = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Altre', date: '2099-05-17' as unknown as Date, legacyId: '43' });
    const person = await savePerson('100');
    await db.dataSource
      .getRepository(Attendance)
      .save({ event: other, person, status: AttendanceStatus.NO_VAIG, respondedAt: new Date() });
    legacyApiClient.getAssistenciesXlsx.mockResolvedValue([row('100')]);

    await strategy.syncAll(subscriber, [event]);

    expect((await findRow(other, person))?.status).toBe(AttendanceStatus.NO_VAIG);
  });
});
