import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Between, In, Repository } from 'typeorm';
import {
  BeforeEventOffsetUnit,
  BeforeEventScheduleConfig,
  EventType,
  NotificationScheduleType,
  NotificationSource,
  WeeklyScheduleConfig,
} from '@muixer/shared';
import {
  addDaysToDateOnly,
  getLocalDayOfWeek,
  getLocalTimeOfDay,
  getLocalToday,
  formatDateOnly,
  zonedTimeToUtc,
} from '../../common/utils/date.util';
import { computeBeforeEventFireInstant, hasEventStarted } from './notification-schedule-rules.util';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { Event } from '../event/event.entity';
import { NotificationScheduleService } from './notification-schedule.service';

@Injectable()
export class NotificationScheduleCronService {
  private readonly logger = new Logger(NotificationScheduleCronService.name);

  constructor(
    @InjectRepository(NotificationSchedule)
    private readonly repo: Repository<NotificationSchedule>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    private readonly scheduleService: NotificationScheduleService,
  ) {}

  /** Every minute: dispatch any active ONE_OFF schedule whose time has come. Schedules are
   *  processed one at a time — `processSchedule` flips `isActive` to false before dispatching,
   *  so a schedule already picked up by this tick won't be picked up again by an overlapping one. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueOneOffSchedules(): Promise<void> {
    const due = await this.repo
      .createQueryBuilder('s')
      .where('s.isActive = true')
      .andWhere('s.scheduleType = :type', { type: NotificationScheduleType.ONE_OFF })
      // Raw jsonb operator expression — TypeORM's alias.property rewriting doesn't reach inside
      // it, so the camelCase column must be quoted by hand or Postgres downcases it to a
      // nonexistent "ruleconfig" (caught only by an integration test against real Postgres).
      .andWhere(`("s"."ruleConfig"->>'scheduledFor')::timestamptz <= :now`, { now: new Date() })
      .getMany();

    for (const schedule of due) {
      try {
        await this.scheduleService.processSchedule(schedule, NotificationSource.SCHEDULED_ONE_OFF);
      } catch (error) {
        this.logger.error(`Failed to process notification schedule ${schedule.id}`, error as Error);
      }
    }
  }

  /** Every minute: dispatch any active WEEKLY schedule whose day+time has come and hasn't already
   *  fired today. Unlike ONE_OFF, `processSchedule` leaves it active — this method's own
   *  "already fired today" check (via the most recent NotificationLog row) is what prevents a
   *  duplicate send from an overlapping or later-that-day tick. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueWeeklySchedules(): Promise<void> {
    const dayOfWeek = getLocalDayOfWeek();
    const timeOfDay = getLocalTimeOfDay();

    const due = await this.repo
      .createQueryBuilder('s')
      .where('s.isActive = true')
      .andWhere('s.scheduleType = :type', { type: NotificationScheduleType.WEEKLY })
      .andWhere(`("s"."ruleConfig"->>'dayOfWeek')::int = :dayOfWeek`, { dayOfWeek })
      .andWhere(`"s"."ruleConfig"->>'timeOfDay' <= :timeOfDay`, { timeOfDay })
      .getMany();

    for (const schedule of due) {
      try {
        if (this.outsideActiveWindow(schedule)) continue;
        if (this.createdAfterTodaysOccurrence(schedule)) continue;
        if (await this.firedToday(schedule.id)) continue;
        await this.scheduleService.processSchedule(schedule, NotificationSource.SCHEDULED_WEEKLY);
      } catch (error) {
        this.logger.error(`Failed to process weekly notification schedule ${schedule.id}`, error as Error);
      }
    }
  }

  /** Every minute: for each active BEFORE_EVENT schedule, find its matching upcoming events and
   *  dispatch once per event whose computed fire instant has passed. Unlike WEEKLY's single
   *  "fired today" check, one schedule must fire independently for every matching event — so the
   *  "already fired" check is keyed by (scheduleId, eventId), not by day.
   *
   *  Runs every minute, so the query count is fixed rather than growing with the data: one query
   *  for the schedules, one per distinct `eventType` for the events (only those close enough for
   *  some offset to have come due), and one for the "already fired" logs of every due pair. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueBeforeEventSchedules(): Promise<void> {
    const schedules = (
      await this.repo
        .createQueryBuilder('s')
        .where('s.isActive = true')
        .andWhere('s.scheduleType = :type', { type: NotificationScheduleType.BEFORE_EVENT })
        .getMany()
    ).filter((schedule) => !this.outsideActiveWindow(schedule));
    if (schedules.length === 0) return;

    try {
      const due = await this.findDueBeforeEventPairs(schedules, new Date());
      if (due.length === 0) return;
      const fired = await this.firedPairs(due);

      for (const { schedule, eventId } of due) {
        if (fired.has(pairKey(schedule.id, eventId))) continue;
        try {
          await this.scheduleService.processSchedule(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, eventId);
        } catch (error) {
          this.logger.error(
            `Failed to process before-event notification schedule ${schedule.id} for event ${eventId}`,
            error as Error,
          );
        }
      }
    } catch (error) {
      this.logger.error('Failed to process before-event notification schedules', error as Error);
    }
  }

  /** Every (schedule, event) whose fire instant has passed and whose event hasn't started yet. */
  private async findDueBeforeEventPairs(
    schedules: NotificationSchedule[],
    now: Date,
  ): Promise<{ schedule: NotificationSchedule; eventId: string }[]> {
    const eventsByType = await this.loadCandidateEvents(schedules);
    const due: { schedule: NotificationSchedule; eventId: string }[] = [];

    for (const schedule of schedules) {
      const rule = schedule.ruleConfig as BeforeEventScheduleConfig;
      for (const event of eventsByType.get(rule.eventType) ?? []) {
        const fireInstant = computeBeforeEventFireInstant(rule, event);
        if (!fireInstant || fireInstant > now) continue;
        if (hasEventStarted(event, now)) continue;
        due.push({ schedule, eventId: event.id });
      }
    }
    return due;
  }

  /** Events from today up to the furthest day any schedule's offset can already reach, one query
   *  per `eventType`. A reminder never makes sense after its event, so past events are excluded;
   *  a missed tick still self-heals, since the event stays matched until it passes. */
  private async loadCandidateEvents(schedules: NotificationSchedule[]): Promise<Map<EventType, Event[]>> {
    const horizonByType = new Map<EventType, number>();
    for (const schedule of schedules) {
      const rule = schedule.ruleConfig as BeforeEventScheduleConfig;
      const horizon = beforeEventHorizonDays(rule);
      horizonByType.set(rule.eventType, Math.max(horizonByType.get(rule.eventType) ?? 0, horizon));
    }

    const today = getLocalToday();
    const entries = await Promise.all(
      [...horizonByType].map(async ([eventType, horizon]): Promise<[EventType, Event[]]> => [
        eventType,
        await this.eventRepo.find({
          select: { id: true, date: true, startTime: true },
          where: {
            eventType,
            date: Between(today as unknown as Date, addDaysToDateOnly(today, horizon) as unknown as Date),
          },
        }),
      ]),
    );
    return new Map(entries);
  }

  /** Which of `pairs` already have a log row, in a single query (served by the
   *  `(scheduleId, triggeredEventId)` index). The IN × IN may match a few extra combinations;
   *  the key set filters them out. */
  private async firedPairs(pairs: { schedule: NotificationSchedule; eventId: string }[]): Promise<Set<string>> {
    const logs = await this.logRepo.find({
      select: { scheduleId: true, triggeredEventId: true },
      where: {
        scheduleId: In([...new Set(pairs.map((pair) => pair.schedule.id))]),
        triggeredEventId: In([...new Set(pairs.map((pair) => pair.eventId))]),
      },
    });
    return new Set(logs.map((log) => pairKey(log.scheduleId as string, log.triggeredEventId as string)));
  }

  /** A WEEKLY schedule created later in the day than its own send time must not fire within the
   *  minute: its first send is next week, which is also what the next-run projection shows. The
   *  `firedToday` log check can't catch this — the schedule has no log rows at all yet. */
  private createdAfterTodaysOccurrence(schedule: NotificationSchedule): boolean {
    const rule = schedule.ruleConfig as WeeklyScheduleConfig;
    if (!schedule.createdAt) return false;
    return schedule.createdAt > zonedTimeToUtc(getLocalToday(), rule.timeOfDay);
  }

  private async firedToday(scheduleId: string): Promise<boolean> {
    const lastLog = await this.logRepo.findOne({ where: { scheduleId }, order: { sentAt: 'DESC' } });
    return !!lastLog && formatDateOnly(lastLog.sentAt) === getLocalToday();
  }

  /** `startDate`/`endDate` (`YYYY-MM-DD`, inclusive) gate a WEEKLY or BEFORE_EVENT schedule outside
   *  of the SQL query — string comparison against `getLocalToday()`, reusing the same date-only
   *  convention as `firedToday`, rather than another raw jsonb expression in the WHERE clause. */
  private outsideActiveWindow(schedule: NotificationSchedule): boolean {
    const rule = schedule.ruleConfig as { startDate?: string; endDate?: string };
    const today = getLocalToday();
    if (rule.startDate && today < rule.startDate) return true;
    if (rule.endDate && today > rule.endDate) return true;
    return false;
  }
}

function pairKey(scheduleId: string, eventId: string): string {
  return `${scheduleId}:${eventId}`;
}

/** How many days ahead of today an event can be and still have this rule's reminder already due:
 *  a DAYS offset fires on (event date − offset); an HOURS offset fires at (start − offset), which
 *  from any time today lands at most ⌈offset / 24⌉ days ahead. */
function beforeEventHorizonDays(rule: BeforeEventScheduleConfig): number {
  return rule.offsetUnit === BeforeEventOffsetUnit.HOURS ? Math.ceil(rule.offsetValue / 24) : rule.offsetValue;
}
