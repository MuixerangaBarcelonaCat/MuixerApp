import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MoreThanOrEqual, Repository } from 'typeorm';
import {
  BeforeEventScheduleConfig,
  NotificationScheduleType,
  NotificationSource,
  WeeklyScheduleConfig,
} from '@muixer/shared';
import {
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
   *  "already fired" check is keyed by (scheduleId, eventId), not by day. */
  @Cron(CronExpression.EVERY_MINUTE)
  async processDueBeforeEventSchedules(): Promise<void> {
    const due = await this.repo
      .createQueryBuilder('s')
      .where('s.isActive = true')
      .andWhere('s.scheduleType = :type', { type: NotificationScheduleType.BEFORE_EVENT })
      .getMany();

    for (const schedule of due) {
      if (this.outsideActiveWindow(schedule)) continue;
      try {
        await this.processBeforeEventSchedule(schedule);
      } catch (error) {
        this.logger.error(`Failed to process before-event notification schedule ${schedule.id}`, error as Error);
      }
    }
  }

  private async processBeforeEventSchedule(schedule: NotificationSchedule): Promise<void> {
    const rule = schedule.ruleConfig as BeforeEventScheduleConfig;
    const now = new Date();

    // Only events that haven't happened yet — a reminder never makes sense to send after the
    // event it's about. A missed tick still self-heals: the event stays matched until it passes.
    const events = await this.eventRepo.find({
      where: { eventType: rule.eventType, date: MoreThanOrEqual(getLocalToday() as unknown as Date) },
    });

    for (const event of events) {
      try {
        const fireInstant = computeBeforeEventFireInstant(rule, event);
        if (!fireInstant || fireInstant > now) continue;
        if (hasEventStarted(event, now)) continue;
        if (await this.firedForEvent(schedule.id, event.id)) continue;
        await this.scheduleService.processSchedule(schedule, NotificationSource.SCHEDULED_BEFORE_EVENT, event.id);
      } catch (error) {
        this.logger.error(
          `Failed to process before-event notification schedule ${schedule.id} for event ${event.id}`,
          error as Error,
        );
      }
    }
  }

  /** A WEEKLY schedule created later in the day than its own send time must not fire within the
   *  minute: its first send is next week, which is also what the next-run projection shows. The
   *  `firedToday` log check can't catch this — the schedule has no log rows at all yet. */
  private createdAfterTodaysOccurrence(schedule: NotificationSchedule): boolean {
    const rule = schedule.ruleConfig as WeeklyScheduleConfig;
    if (!schedule.createdAt) return false;
    return schedule.createdAt > zonedTimeToUtc(getLocalToday(), rule.timeOfDay);
  }

  private async firedForEvent(scheduleId: string, eventId: string): Promise<boolean> {
    const log = await this.logRepo.findOne({ where: { scheduleId, triggeredEventId: eventId } });
    return !!log;
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
