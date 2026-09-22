import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { NotificationScheduleType, NotificationSource } from '@muixer/shared';
import { getLocalDayOfWeek, getLocalTimeOfDay, getLocalToday, formatDateOnly } from '../../common/utils/date.util';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationScheduleService } from './notification-schedule.service';

@Injectable()
export class NotificationScheduleCronService {
  private readonly logger = new Logger(NotificationScheduleCronService.name);

  constructor(
    @InjectRepository(NotificationSchedule)
    private readonly repo: Repository<NotificationSchedule>,
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
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
        if (await this.firedToday(schedule.id)) continue;
        await this.scheduleService.processSchedule(schedule, NotificationSource.SCHEDULED_WEEKLY);
      } catch (error) {
        this.logger.error(`Failed to process weekly notification schedule ${schedule.id}`, error as Error);
      }
    }
  }

  private async firedToday(scheduleId: string): Promise<boolean> {
    const lastLog = await this.logRepo.findOne({ where: { scheduleId }, order: { sentAt: 'DESC' } });
    return !!lastLog && formatDateOnly(lastLog.sentAt) === getLocalToday();
  }

  /** `startDate`/`endDate` (`YYYY-MM-DD`, inclusive) gate a WEEKLY schedule outside of the SQL
   *  query — string comparison against `getLocalToday()`, reusing the same date-only convention
   *  as `firedToday`, rather than another raw jsonb expression in the WHERE clause. */
  private outsideActiveWindow(schedule: NotificationSchedule): boolean {
    const rule = schedule.ruleConfig;
    if (!('dayOfWeek' in rule)) return false;
    const today = getLocalToday();
    if (rule.startDate && today < rule.startDate) return true;
    if (rule.endDate && today > rule.endDate) return true;
    return false;
  }
}
