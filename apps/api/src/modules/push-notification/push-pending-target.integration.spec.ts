import { Test, TestingModule } from '@nestjs/testing';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AttendanceStatus,
  EventReferenceKind,
  EventType,
  NotificationSource,
  NotificationTargetType,
} from '@muixer/shared';
import { PushNotificationService } from './push-notification.service';
import { PushSubscriptionService } from './push-subscription.service';
import { PushSenderService } from './push-sender.service';
import { NotificationLogService } from './notification-log.service';
import { SendNotificationDto } from './dto/send-notification.dto';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
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
 * Real-Postgres suite for the EVENT_ATTENDANCE push target with filter PENDENT: no row ≡ PENDENT,
 * so "haven't answered" must reach users whose person has no row (or a PENDENT one) — but not
 * people created after the event day (NO_REGISTRAT).
 */
describe('PushNotificationService PENDENT target (integration)', () => {
  let db: IntegrationDb;
  let service: PushNotificationService;
  const logService = { record: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  beforeAll(async () => {
    db = await setupIntegrationDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        ...realRepositoryProviders(db.dataSource, [Attendance, Event, User]),
        { provide: PushSubscriptionService, useValue: {} },
        { provide: PushSenderService, useValue: {} },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: NotificationLogService, useValue: logService },
      ],
    }).compile();

    service = module.get(PushNotificationService);
  });

  afterAll(async () => {
    await teardownIntegrationDb(db);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await truncateAllTables(db.dataSource);
  });

  /** A person with an active user account, `createdAt` backdated (TypeORM stamps now() on insert). */
  const saveMember = async (alias: string, createdAt: string) => {
    const person = await db.dataSource.getRepository(Person).save({ name: 'N', firstSurname: alias, alias });
    await db.dataSource.query(`UPDATE persons SET "createdAt" = $1 WHERE id = $2`, [createdAt, person.id]);
    const user = await db.dataSource
      .getRepository(User)
      .save({ email: `${alias}@test.cat`, isActive: true, person });
    return { person, user };
  };

  const sendTo = (eventId: string, attendanceFilter?: AttendanceStatus) =>
    service.send(
      {
        title: 'Recordatori',
        body: 'Contesteu',
        target: { type: NotificationTargetType.EVENT_ATTENDANCE, attendanceFilter },
        linkedEvent: { kind: EventReferenceKind.SPECIFIC, eventId },
      } as unknown as SendNotificationDto,
      { source: NotificationSource.MANUAL },
    );

  const recipients = (): string[] => [...eventEmitter.emit.mock.calls[0][1].userIds].sort();

  it('targets users with no row or a PENDENT row, and not NO_REGISTRAT ones', async () => {
    const event = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: '2026-05-10' as unknown as Date });
    const noRow = await saveMember('sensefila', '2026-01-01T10:00:00Z');
    const pendingRow = await saveMember('pendent', '2026-01-01T10:00:00Z');
    const going = await saveMember('va', '2026-01-01T10:00:00Z');
    await saveMember('tard', '2026-05-11T10:00:00Z');
    const attendances = db.dataSource.getRepository(Attendance);
    await attendances.save({ event, person: pendingRow.person, status: AttendanceStatus.PENDENT, respondedAt: new Date() });
    await attendances.save({ event, person: going.person, status: AttendanceStatus.ANIRE, respondedAt: new Date() });

    await sendTo(event.id, AttendanceStatus.PENDENT);

    expect(recipients()).toEqual([noRow.user.id, pendingRow.user.id].sort());
  });

  it('keeps answered filters row-based', async () => {
    const event = await db.dataSource
      .getRepository(Event)
      .save({ eventType: EventType.ASSAIG, title: 'Assaig', date: '2026-05-10' as unknown as Date });
    await saveMember('sensefila', '2026-01-01T10:00:00Z');
    const going = await saveMember('va', '2026-01-01T10:00:00Z');
    await db.dataSource
      .getRepository(Attendance)
      .save({ event, person: going.person, status: AttendanceStatus.ANIRE, respondedAt: new Date() });

    await sendTo(event.id, AttendanceStatus.ANIRE);

    expect(recipients()).toEqual([going.user.id]);
  });
});
