import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { NotificationScheduleType, NotificationSource } from '@muixer/shared';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { NotificationScheduleService } from './notification-schedule.service';

@Injectable()
export class NotificationScheduleCronService {
  private readonly logger = new Logger(NotificationScheduleCronService.name);

  constructor(
    @InjectRepository(NotificationSchedule)
    private readonly repo: Repository<NotificationSchedule>,
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
}
