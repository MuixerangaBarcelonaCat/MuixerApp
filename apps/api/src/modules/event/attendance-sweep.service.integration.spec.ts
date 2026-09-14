import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EventType, AttendanceStatus } from '@muixer/shared';
import { getLocalToday } from '../../common/utils/date.util';
import { AttendanceSweepService } from './attendance-sweep.service';
import { AttendanceService } from './attendance.service';
import { AuditService } from '../audit/audit.service';
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
 * Real-Postgres coverage for the performance attendance sweep: the `UPDATE ... WHERE status = 'ANIRE'`
 * and the summary recalculation only make sense against a live database.
 */
describe('AttendanceSweepService (integration)', () => {
  let db: IntegrationDb;
  let service: AttendanceSweepService;

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceSweepService,
        AttendanceService,
        ...realRepositoryProviders(db.dataSource, [Attendance, Event, Person]),
        { provide: DataSource, useValue: db.dataSource },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(AttendanceSweepService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    await truncateAllTables(db.dataSource);
  });

  let aliasSeq = 0;

  const seedAttendances = async (eventId: string, statuses: AttendanceStatus[]) => {
    const personRepo = db.dataSource.getRepository(Person);
    const attRepo = db.dataSource.getRepository(Attendance);
    for (const status of statuses) {
      const person = await personRepo.save({ name: 'P', firstSurname: 'X', alias: `sweep-${aliasSeq++}` });
      await attRepo.save({
        event: { id: eventId },
        person: { id: person.id },
        status,
        respondedAt: new Date('2020-01-01T00:00:00.000Z'),
      });
    }
  };

  it('flips ANIRE to ASSISTIT for a performance today, leaving other statuses and respondedAt intact', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const attRepo = db.dataSource.getRepository(Attendance);

    const performance = await eventRepo.save({
      eventType: EventType.ACTUACIO,
      title: 'Actuació avui',
      date: getLocalToday(),
    });
    await seedAttendances(performance.id, [
      AttendanceStatus.ANIRE,
      AttendanceStatus.ANIRE,
      AttendanceStatus.NO_VAIG,
      AttendanceStatus.PENDENT,
    ]);

    await service.sweepTodaysPerformances();

    const after = await attRepo.find({ where: { event: { id: performance.id } } });
    const byStatus = (s: AttendanceStatus) => after.filter((a) => a.status === s).length;
    expect(byStatus(AttendanceStatus.ASSISTIT)).toBe(2);
    expect(byStatus(AttendanceStatus.NO_VAIG)).toBe(1);
    expect(byStatus(AttendanceStatus.PENDENT)).toBe(1);
    expect(byStatus(AttendanceStatus.ANIRE)).toBe(0);

    for (const att of after) {
      expect(att.respondedAt?.toISOString()).toBe('2020-01-01T00:00:00.000Z');
    }

    const refreshed = await eventRepo.findOne({ where: { id: performance.id } });
    expect(refreshed!.attendanceSummary.attended).toBe(2);
  });

  it('never touches rehearsals today or performances on another day', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const attRepo = db.dataSource.getRepository(Attendance);

    const rehearsalToday = await eventRepo.save({
      eventType: EventType.ASSAIG,
      title: 'Assaig avui',
      date: getLocalToday(),
    });
    const performanceYesterday = await eventRepo.save({
      eventType: EventType.ACTUACIO,
      title: 'Actuació ahir',
      date: '2020-05-01',
    });
    await seedAttendances(rehearsalToday.id, [AttendanceStatus.ANIRE]);
    await seedAttendances(performanceYesterday.id, [AttendanceStatus.ANIRE]);

    await service.sweepTodaysPerformances();

    const all = await attRepo.find();
    expect(all.every((a) => a.status === AttendanceStatus.ANIRE)).toBe(true);
  });

  it('is idempotent on a second run', async () => {
    const eventRepo = db.dataSource.getRepository(Event);
    const attRepo = db.dataSource.getRepository(Attendance);

    const performance = await eventRepo.save({
      eventType: EventType.ACTUACIO,
      title: 'Actuació avui',
      date: getLocalToday(),
    });
    await seedAttendances(performance.id, [AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG]);

    await service.sweepTodaysPerformances();
    await service.sweepTodaysPerformances();

    const after = await attRepo.find({ where: { event: { id: performance.id } } });
    expect(after.filter((a) => a.status === AttendanceStatus.ASSISTIT).length).toBe(1);
    expect(after.filter((a) => a.status === AttendanceStatus.NO_VAIG).length).toBe(1);
  });
});
