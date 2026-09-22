import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PushNotificationService } from './push-notification.service';
import { PushSenderService } from './push-sender.service';
import { PushSubscriptionService } from './push-subscription.service';
import { NotificationLogService } from './notification-log.service';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { User } from '../user/user.entity';
import { EventReferenceKind, EventType, NotificationLinkType, NotificationSource, NotificationTargetType } from '@muixer/shared';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushRequestedEvent } from './events/push-requested.event';

const makeDto = (targetType: NotificationTargetType = NotificationTargetType.ALL, overrides = {}): SendNotificationDto => {
  const dto = new SendNotificationDto();
  dto.title = 'Test title';
  dto.body = 'Test body';
  dto.linkTo = NotificationLinkType.HOME;
  dto.target = { type: targetType, ...overrides };
  return dto;
};

const mockAttendanceQueryBuilder = (rows: { userId: string }[]) => ({
  innerJoin: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getRawMany: jest.fn().mockResolvedValue(rows),
});

describe('PushNotificationService', () => {
  let service: PushNotificationService;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let subscriptionService: jest.Mocked<PushSubscriptionService>;
  let senderService: jest.Mocked<PushSenderService>;
  let logService: jest.Mocked<NotificationLogService>;
  let attendanceRepo: { createQueryBuilder: jest.Mock };
  let eventRepo: { findOne: jest.Mock };

  beforeEach(async () => {
    attendanceRepo = { createQueryBuilder: jest.fn().mockReturnValue(mockAttendanceQueryBuilder([{ userId: 'u1' }, { userId: 'u2' }])) };
    eventRepo = { findOne: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        PushNotificationService,
        {
          provide: getRepositoryToken(Attendance),
          useValue: attendanceRepo,
        },
        {
          provide: getRepositoryToken(Event),
          useValue: eventRepo,
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            find: jest.fn().mockResolvedValue([{ id: 'u1' }, { id: 'u2' }]),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: PushSubscriptionService,
          useValue: {
            findActiveByUserIds: jest.fn(),
            markUsedMany: jest.fn(),
            deactivateMany: jest.fn(),
            findUserIdsWithActiveSubscriptions: jest.fn(),
          },
        },
        {
          provide: PushSenderService,
          useValue: { send: jest.fn() },
        },
        {
          provide: EventEmitter2,
          useValue: { emit: jest.fn() },
        },
        {
          provide: NotificationLogService,
          useValue: { record: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PushNotificationService);
    eventEmitter = module.get(EventEmitter2);
    subscriptionService = module.get(PushSubscriptionService);
    senderService = module.get(PushSenderService);
    logService = module.get(NotificationLogService);
  });

  describe('send (ALL target)', () => {
    it('emits push.requested event and returns accepted', async () => {
      const result = await service.send(makeDto(NotificationTargetType.ALL), { source: NotificationSource.MANUAL });
      expect(eventEmitter.emit).toHaveBeenCalledWith('push.requested', expect.any(PushRequestedEvent));
      expect(result.accepted).toBe(true);
    });

    it('returns warning when no users found', async () => {
      const userRepo = { find: jest.fn().mockResolvedValue([]) };
      // Rebuild with empty userRepo
      const module = await Test.createTestingModule({
        providers: [
          PushNotificationService,
          { provide: getRepositoryToken(Attendance), useValue: { createQueryBuilder: jest.fn() } },
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: PushSubscriptionService, useValue: subscriptionService },
          { provide: PushSenderService, useValue: senderService },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: NotificationLogService, useValue: logService },
        ],
      }).compile();
      const svcEmpty = module.get(PushNotificationService);
      const result = await svcEmpty.send(makeDto(NotificationTargetType.ALL), { source: NotificationSource.MANUAL });
      expect(result.warning).toBeDefined();
    });

    it('logs a MANUAL entry with the resolved recipient count', async () => {
      await service.send(makeDto(NotificationTargetType.ALL), { source: NotificationSource.MANUAL, triggeredByUserId: 'user-1' });

      expect(logService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Test title',
          body: 'Test body',
          recipientCount: 2,
          source: NotificationSource.MANUAL,
          triggeredByUserId: 'user-1',
        }),
      );
    });

    it('logs the scheduleId and source passed through meta, for a scheduled dispatch', async () => {
      await service.send(makeDto(NotificationTargetType.ALL), {
        source: NotificationSource.SCHEDULED_ONE_OFF,
        scheduleId: 'schedule-1',
      });

      expect(logService.record).toHaveBeenCalledWith(
        expect.objectContaining({ source: NotificationSource.SCHEDULED_ONE_OFF, scheduleId: 'schedule-1' }),
      );
    });

    it('still logs the entry when no subscribers are found, with recipientCount 0', async () => {
      const userRepo = { find: jest.fn().mockResolvedValue([]) };
      const module = await Test.createTestingModule({
        providers: [
          PushNotificationService,
          { provide: getRepositoryToken(Attendance), useValue: { createQueryBuilder: jest.fn() } },
          { provide: getRepositoryToken(Event), useValue: eventRepo },
          { provide: getRepositoryToken(User), useValue: userRepo },
          { provide: PushSubscriptionService, useValue: subscriptionService },
          { provide: PushSenderService, useValue: senderService },
          { provide: EventEmitter2, useValue: eventEmitter },
          { provide: NotificationLogService, useValue: logService },
        ],
      }).compile();
      const svcEmpty = module.get(PushNotificationService);

      await svcEmpty.send(makeDto(NotificationTargetType.ALL), { source: NotificationSource.MANUAL });

      expect(logService.record).toHaveBeenCalledWith(
        expect.objectContaining({ recipientCount: 0, source: NotificationSource.MANUAL }),
      );
    });
  });

  describe('send (EVENT_ATTENDANCE target)', () => {
    const eventDto = (linkedEvent: Record<string, unknown>, overrides: Record<string, unknown> = {}) => {
      const dto = makeDto(NotificationTargetType.EVENT_ATTENDANCE, { attendanceFilter: undefined, ...overrides });
      dto.linkedEvent = linkedEvent as never;
      return dto;
    };

    it('resolves SPECIFIC using the given eventId directly, without an Event lookup', async () => {
      await service.send(eventDto({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-specific' }), { source: NotificationSource.MANUAL });

      expect(eventRepo.findOne).not.toHaveBeenCalled();
      expect(attendanceRepo.createQueryBuilder().where).toHaveBeenCalledWith('e.id = :eventId', {
        eventId: 'evt-specific',
      });
    });

    it('resolves NEXT_ACTUACIO to the nearest upcoming ACTUACIO event', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-actuacio' });

      await service.send(eventDto({ kind: EventReferenceKind.NEXT_ACTUACIO }), { source: NotificationSource.MANUAL });

      expect(eventRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ eventType: EventType.ACTUACIO }),
          order: { date: 'ASC' },
        }),
      );
      expect(attendanceRepo.createQueryBuilder().where).toHaveBeenCalledWith('e.id = :eventId', {
        eventId: 'evt-actuacio',
      });
    });

    it('resolves NEXT_ASSAIG to the nearest upcoming ASSAIG event', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-assaig' });

      await service.send(eventDto({ kind: EventReferenceKind.NEXT_ASSAIG }), { source: NotificationSource.MANUAL });

      expect(eventRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ eventType: EventType.ASSAIG }) }),
      );
      expect(attendanceRepo.createQueryBuilder().where).toHaveBeenCalledWith('e.id = :eventId', {
        eventId: 'evt-assaig',
      });
    });

    it('resolves NEXT_ACTUACIO_OR_ASSAIG to the nearest upcoming event of either type', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-either' });

      await service.send(eventDto({ kind: EventReferenceKind.NEXT_ACTUACIO_OR_ASSAIG }), { source: NotificationSource.MANUAL });

      const [[callArgs]] = eventRepo.findOne.mock.calls;
      expect(callArgs.where.eventType).toBeUndefined();
      expect(attendanceRepo.createQueryBuilder().where).toHaveBeenCalledWith('e.id = :eventId', {
        eventId: 'evt-either',
      });
    });

    it('returns a warning and zero recipients when no upcoming event matches', async () => {
      eventRepo.findOne.mockResolvedValue(null);
      attendanceRepo.createQueryBuilder.mockReturnValue(mockAttendanceQueryBuilder([]));

      const result = await service.send(eventDto({ kind: EventReferenceKind.NEXT_ACTUACIO }), { source: NotificationSource.MANUAL });

      expect(result.warning).toBeDefined();
      expect(logService.record).toHaveBeenCalledWith(expect.objectContaining({ recipientCount: 0 }));
    });

    it('logs the resolved concrete eventId, not the abstract eventRef', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-resolved' });

      await service.send(eventDto({ kind: EventReferenceKind.NEXT_ACTUACIO }), { source: NotificationSource.MANUAL });

      expect(logService.record).toHaveBeenCalledWith(
        expect.objectContaining({
          target: { type: NotificationTargetType.EVENT_ATTENDANCE, eventId: 'evt-resolved', attendanceFilter: undefined },
        }),
      );
    });

    it('passes the attendanceFilter through to the attendance query', async () => {
      await service.send(eventDto({ kind: EventReferenceKind.SPECIFIC, eventId: 'evt-1' }, { attendanceFilter: 'ANIRE' }), { source: NotificationSource.MANUAL });

      expect(attendanceRepo.createQueryBuilder().andWhere).toHaveBeenCalledWith('a.status = :status', {
        status: 'ANIRE',
      });
    });

    it('only resolves the linked event once, reusing it for both attendees and the link', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-once' });
      const dto = eventDto({ kind: EventReferenceKind.NEXT_ACTUACIO });
      dto.linkTo = NotificationLinkType.EVENT;

      await service.send(dto, { source: NotificationSource.MANUAL });

      expect(eventRepo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('send (linkTo)', () => {
    it('resolves HOME to /home', async () => {
      const dto = makeDto(NotificationTargetType.ALL);
      dto.linkTo = NotificationLinkType.HOME;

      await service.send(dto, { source: NotificationSource.MANUAL });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'push.requested',
        expect.objectContaining({ payload: expect.objectContaining({ url: '/home' }) }),
      );
    });

    it('resolves CUSTOM to the given url', async () => {
      const dto = makeDto(NotificationTargetType.ALL);
      dto.linkTo = NotificationLinkType.CUSTOM;
      dto.url = '/noticies/123';

      await service.send(dto, { source: NotificationSource.MANUAL });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'push.requested',
        expect.objectContaining({ payload: expect.objectContaining({ url: '/noticies/123' }) }),
      );
    });

    it('resolves EVENT to the resolved linked event page', async () => {
      eventRepo.findOne.mockResolvedValue({ id: 'evt-link' });
      const dto = makeDto(NotificationTargetType.ALL);
      dto.linkTo = NotificationLinkType.EVENT;
      dto.linkedEvent = { kind: EventReferenceKind.NEXT_ACTUACIO } as never;

      await service.send(dto, { source: NotificationSource.MANUAL });

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'push.requested',
        expect.objectContaining({ payload: expect.objectContaining({ url: '/events/evt-link' }) }),
      );
      expect(logService.record).toHaveBeenCalledWith(expect.objectContaining({ url: '/events/evt-link' }));
    });
  });

  describe('handlePushRequested', () => {
    it('marks subscription as used on success', async () => {
      const subs = [{ id: 'sub-1', endpoint: 'https://fcm.googleapis.com/push/1', keys: { p256dh: 'a', auth: 'b' } }];
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockResolvedValue({ success: true, statusCode: 201 });

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.markUsedMany).toHaveBeenCalledWith(['sub-1']);
    });

    it('deactivates subscription on 410 Gone', async () => {
      const subs = [{ id: 'sub-gone', endpoint: 'https://fcm.googleapis.com/push/2', keys: { p256dh: 'a', auth: 'b' } }];
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockResolvedValue({ success: false, statusCode: 410, gone: true });

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.deactivateMany).toHaveBeenCalledWith(['sub-gone']);
    });

    it('writes the bookkeeping of a whole fan-out as one call per outcome, not one per device', async () => {
      const subs = Array.from({ length: 50 }, (_, i) => ({
        id: `sub-${i}`,
        endpoint: `https://fcm.googleapis.com/push/${i}`,
        keys: { p256dh: 'a', auth: 'b' },
      }));
      subscriptionService.findActiveByUserIds.mockResolvedValue(subs as never);
      senderService.send.mockImplementation((sub: { id: string }) =>
        Promise.resolve(
          sub.id === 'sub-7' ? { success: false, statusCode: 410, gone: true } : { success: true, statusCode: 201 },
        ),
      );

      await service.handlePushRequested(new PushRequestedEvent(['u1'], { title: 'T', body: 'B' }));

      expect(subscriptionService.markUsedMany).toHaveBeenCalledTimes(1);
      expect(subscriptionService.deactivateMany).toHaveBeenCalledTimes(1);
      expect(subscriptionService.markUsedMany.mock.calls[0][0]).toHaveLength(49);
      expect(subscriptionService.deactivateMany).toHaveBeenCalledWith(['sub-7']);
    });
  });
});
