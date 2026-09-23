import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BeforeEventOffsetUnit,
  EventType,
  NotificationLinkType,
  NotificationScheduleRuleConfig,
  NotificationScheduleType,
  NotificationTargetType,
} from '@muixer/shared';
import { NotificationScheduleNextRunService } from './notification-schedule-next-run.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { Event } from '../event/event.entity';

// Madrid is CEST (+2) at this instant: local Monday 2026-06-01, 14:00.
const FIXED_NOW = new Date('2026-06-01T12:00:00.000Z');

const makeSchedule = (
  scheduleType: NotificationScheduleType,
  ruleConfig: NotificationScheduleRuleConfig,
  overrides: Partial<NotificationSchedule> = {},
): NotificationSchedule =>
  ({
    id: 'schedule-1',
    title: 'Assaig',
    body: 'Recordatori',
    linkedEvent: null,
    linkTo: NotificationLinkType.HOME,
    url: null,
    target: { type: NotificationTargetType.ALL },
    scheduleType,
    ruleConfig,
    isActive: true,
    ...overrides,
  }) as unknown as NotificationSchedule;

const makeEvent = (id: string, date: string, startTime: string | null, eventType = EventType.ACTUACIO): Event =>
  ({ id, date: new Date(`${date}T00:00:00.000Z`), startTime, eventType }) as unknown as Event;

describe('NotificationScheduleNextRunService', () => {
  let service: NotificationScheduleNextRunService;
  let eventRepo: { find: jest.Mock };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(FIXED_NOW);
    eventRepo = { find: jest.fn().mockResolvedValue([]) };

    const module = await Test.createTestingModule({
      providers: [
        NotificationScheduleNextRunService,
        { provide: getRepositoryToken(Event), useValue: eventRepo },
      ],
    }).compile();

    service = module.get(NotificationScheduleNextRunService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an empty map for no schedules', async () => {
    expect(await service.computeAll([])).toEqual(new Map());
  });

  it('returns null for an inactive schedule, whatever its rule says', async () => {
    const schedule = makeSchedule(
      NotificationScheduleType.WEEKLY,
      { dayOfWeek: 1, timeOfDay: '18:00' },
      { isActive: false },
    );
    const result = await service.computeAll([schedule]);
    expect(result.get('schedule-1')).toBeNull();
  });

  describe('ONE_OFF', () => {
    it('returns the scheduled instant when it is still in the future', async () => {
      const schedule = makeSchedule(NotificationScheduleType.ONE_OFF, {
        scheduledFor: '2026-06-02T10:00:00.000Z',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-02T10:00:00.000Z'));
    });

    it('returns null once the scheduled instant has passed', async () => {
      const schedule = makeSchedule(NotificationScheduleType.ONE_OFF, {
        scheduledFor: '2026-05-30T10:00:00.000Z',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toBeNull();
    });
  });

  describe('WEEKLY', () => {
    it("returns today's occurrence when its time has not passed yet", async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, { dayOfWeek: 1, timeOfDay: '18:00' });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-01T16:00:00.000Z'));
    });

    it("returns next week's occurrence when today's time has already passed", async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, { dayOfWeek: 1, timeOfDay: '09:00' });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-08T07:00:00.000Z'));
    });

    it('returns the occurrence in the same week for a later weekday', async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, { dayOfWeek: 4, timeOfDay: '20:00' });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-04T18:00:00.000Z'));
    });

    it('returns the first occurrence on or after startDate when the window has not opened yet', async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, {
        dayOfWeek: 1,
        timeOfDay: '18:00',
        startDate: '2026-07-01',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-07-06T16:00:00.000Z'));
    });

    it('returns null when the next occurrence falls past endDate', async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, {
        dayOfWeek: 1,
        timeOfDay: '09:00',
        endDate: '2026-06-02',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toBeNull();
    });
  });

  describe('BEFORE_EVENT', () => {
    it('returns the event date minus the offset, at the configured time, for a DAYS offset', async () => {
      eventRepo.find.mockResolvedValue([makeEvent('event-1', '2026-06-10', '20:00')]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.DAYS,
        offsetValue: 3,
        timeOfDay: '09:00',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-07T07:00:00.000Z'));
    });

    it("returns the event's start time minus the offset for an HOURS offset", async () => {
      eventRepo.find.mockResolvedValue([makeEvent('event-1', '2026-06-10', '20:00')]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.HOURS,
        offsetValue: 2,
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-10T16:00:00.000Z'));
    });

    it('skips an event with no startTime for an HOURS offset and uses the next one', async () => {
      eventRepo.find.mockResolvedValue([
        makeEvent('event-1', '2026-06-05', null),
        makeEvent('event-2', '2026-06-10', '20:00'),
      ]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.HOURS,
        offsetValue: 2,
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-10T16:00:00.000Z'));
    });

    it("skips an event whose own fire instant has already passed", async () => {
      eventRepo.find.mockResolvedValue([
        makeEvent('event-1', '2026-06-01', '15:00'),
        makeEvent('event-2', '2026-06-10', '20:00'),
      ]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.HOURS,
        offsetValue: 2,
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toEqual(new Date('2026-06-10T16:00:00.000Z'));
    });

    it('returns null when no upcoming event matches', async () => {
      eventRepo.find.mockResolvedValue([]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.DAYS,
        offsetValue: 3,
        timeOfDay: '09:00',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toBeNull();
    });

    it('returns null when the next fire instant falls past endDate', async () => {
      eventRepo.find.mockResolvedValue([makeEvent('event-1', '2026-06-10', '20:00')]);
      const schedule = makeSchedule(NotificationScheduleType.BEFORE_EVENT, {
        eventType: EventType.ACTUACIO,
        offsetUnit: BeforeEventOffsetUnit.DAYS,
        offsetValue: 3,
        timeOfDay: '09:00',
        endDate: '2026-06-05',
      });
      const result = await service.computeAll([schedule]);
      expect(result.get('schedule-1')).toBeNull();
    });

    it('queries events once per distinct event type, not once per schedule', async () => {
      const rule = (eventType: EventType) => ({
        eventType,
        offsetUnit: BeforeEventOffsetUnit.DAYS,
        offsetValue: 1,
        timeOfDay: '09:00',
      });
      const schedules = [
        makeSchedule(NotificationScheduleType.BEFORE_EVENT, rule(EventType.ACTUACIO), { id: 's1' }),
        makeSchedule(NotificationScheduleType.BEFORE_EVENT, rule(EventType.ACTUACIO), { id: 's2' }),
        makeSchedule(NotificationScheduleType.BEFORE_EVENT, rule(EventType.ASSAIG), { id: 's3' }),
      ];

      await service.computeAll(schedules);

      expect(eventRepo.find).toHaveBeenCalledTimes(2);
    });

    it('does not query events at all when no schedule is BEFORE_EVENT', async () => {
      const schedule = makeSchedule(NotificationScheduleType.WEEKLY, { dayOfWeek: 1, timeOfDay: '18:00' });
      await service.computeAll([schedule]);
      expect(eventRepo.find).not.toHaveBeenCalled();
    });
  });
});
