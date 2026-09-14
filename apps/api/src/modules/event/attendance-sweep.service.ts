import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Repository } from 'typeorm';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { getLocalToday } from '../../common/utils/date.util';
import { AttendanceService } from './attendance.service';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';

/**
 * Public performances (`ACTUACIO`) have no arrival-confirmation tablet like rehearsals do, so
 * nobody ends up marked `ASSISTIT`. This daily job presumes that everyone who said «Vinc»
 * (`ANIRE`) to a performance happening today did attend, and flips them to `ASSISTIT`. The
 * technical team corrects the few no-shows by hand during the lock window.
 *
 * Never touches `ASSAIG` (tablet is the source of truth), `PENDENT` or `NO_VAIG`, and never
 * modifies `respondedAt` (the original «Vinc» response stands). Only ever reads `ANIRE`, so a
 * second run — or a late `ANIRE` created afterwards — is handled correctly and idempotently.
 */
@Injectable()
export class AttendanceSweepService {
  private readonly logger = new Logger(AttendanceSweepService.name);

  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async sweepTodaysPerformances(): Promise<void> {
    const performances = await this.eventRepository.find({
      where: { eventType: EventType.ACTUACIO, date: getLocalToday() as unknown as Date },
    });

    for (const performance of performances) {
      const result = await this.attendanceRepository.update(
        { event: { id: performance.id }, status: AttendanceStatus.ANIRE },
        { status: AttendanceStatus.ASSISTIT },
      );

      if (result.affected && result.affected > 0) {
        await this.attendanceService.recalculateSummary(performance.id);
        this.logger.log(
          `Swept ${result.affected} attendance(s) to ASSISTIT for performance ${performance.id}`,
        );
      }
    }
  }
}
