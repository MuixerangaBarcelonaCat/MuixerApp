import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  BeforeEventScheduleConfig,
  EventType,
  NotificationScheduleType,
  OneOffScheduleConfig,
  WeeklyScheduleConfig,
} from '@muixer/shared';
import { addDaysToDateOnly, formatDateOnly, getLocalToday, zonedTimeToUtc } from '../../common/utils/date.util';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { Event } from '../event/event.entity';
import { computeBeforeEventFireInstant, withinActiveWindow } from './notification-schedule-rules.util';

/** A WEEKLY rule repeats every 7 days, so the next occurrence is always within a fortnight of any
 *  starting point — even when today's own occurrence has already passed. */
const WEEKLY_SEARCH_DAYS = 15;

/**
 * Projects forward: when will each schedule next dispatch? Answers the question the cron never asks
 * (it only asks "is this due right now?"), so the Dashboard can show upcoming sends rather than
 * only the rules that produce them.
 */
@Injectable()
export class NotificationScheduleNextRunService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
  ) {}

  /**
   * Next fire instant per schedule id — `null` when the schedule will never fire again (a spent
   * ONE_OFF, a paused schedule, an exhausted active window, or no matching upcoming event).
   *
   * Batched by design: the BEFORE_EVENT rules in a page share at most one query per `EventType`,
   * rather than one per schedule.
   */
  async computeAll(schedules: NotificationSchedule[], from: Date = new Date()): Promise<Map<string, Date | null>> {
    const upcomingEvents = await this.loadUpcomingEvents(schedules);

    return new Map(schedules.map((schedule) => [schedule.id, this.computeOne(schedule, from, upcomingEvents)]));
  }

  private computeOne(schedule: NotificationSchedule, from: Date, upcomingEvents: Map<EventType, Event[]>): Date | null {
    if (!schedule.isActive) return null;

    switch (schedule.scheduleType) {
      case NotificationScheduleType.ONE_OFF: {
        const at = new Date((schedule.ruleConfig as OneOffScheduleConfig).scheduledFor);
        return at > from ? at : null;
      }
      case NotificationScheduleType.WEEKLY:
        return this.nextWeeklyRun(schedule.ruleConfig as WeeklyScheduleConfig, from);
      case NotificationScheduleType.BEFORE_EVENT: {
        const rule = schedule.ruleConfig as BeforeEventScheduleConfig;
        return this.nextBeforeEventRun(rule, from, upcomingEvents.get(rule.eventType) ?? []);
      }
      default:
        return null;
    }
  }

  /** Walks day by day from today (or from `startDate`, when the window hasn't opened yet) to the
   *  first matching weekday whose local send time is still ahead of `from`. */
  private nextWeeklyRun(rule: WeeklyScheduleConfig, from: Date): Date | null {
    const today = getLocalToday();
    const anchor = rule.startDate && rule.startDate > today ? rule.startDate : today;

    for (let offset = 0; offset < WEEKLY_SEARCH_DAYS; offset++) {
      const date = addDaysToDateOnly(anchor, offset);
      if (dayOfWeekOf(date) !== rule.dayOfWeek) continue;
      if (!withinActiveWindow(date, rule)) continue;

      const at = zonedTimeToUtc(date, rule.timeOfDay);
      if (at > from) return at;
    }
    return null;
  }

  /** The first upcoming event whose own fire instant is still ahead of `from` — an event closer
   *  than the offset itself has already had its reminder sent (or missed), so it's skipped. */
  private nextBeforeEventRun(rule: BeforeEventScheduleConfig, from: Date, events: Event[]): Date | null {
    for (const event of events) {
      const at = computeBeforeEventFireInstant(rule, event);
      if (!at || at <= from) continue;
      if (!withinActiveWindow(formatDateOnly(at), rule)) continue;
      return at;
    }
    return null;
  }

  private async loadUpcomingEvents(schedules: NotificationSchedule[]): Promise<Map<EventType, Event[]>> {
    const eventTypes = new Set(
      schedules
        .filter((schedule) => schedule.isActive && schedule.scheduleType === NotificationScheduleType.BEFORE_EVENT)
        .map((schedule) => (schedule.ruleConfig as BeforeEventScheduleConfig).eventType),
    );

    const entries = await Promise.all(
      [...eventTypes].map(async (eventType): Promise<[EventType, Event[]]> => [
        eventType,
        await this.eventRepo.find({
          where: { eventType, date: MoreThanOrEqual(getLocalToday() as unknown as Date) },
          order: { date: 'ASC' },
        }),
      ]),
    );

    return new Map(entries);
  }
}

/** Day of week (0=Sunday..6=Saturday) of a `YYYY-MM-DD` string — no timezone involved, a date-only
 *  value has no wall-clock component to convert. */
function dayOfWeekOf(dateStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}
