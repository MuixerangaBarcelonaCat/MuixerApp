import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  NotificationScheduleRuleConfig,
  NotificationScheduleType,
  NotificationSource,
  PaginatedResponse,
  WeeklyScheduleConfig,
} from '@muixer/shared';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { CreateNotificationScheduleDto, WeeklyRuleConfigDto } from './dto/create-notification-schedule.dto';
import { UpdateNotificationScheduleDto } from './dto/update-notification-schedule.dto';
import { NotificationScheduleFilterDto } from './dto/notification-schedule-filter.dto';
import { SendNotificationDto } from './dto/send-notification.dto';
import { PushNotificationService } from './push-notification.service';

@Injectable()
export class NotificationScheduleService {
  constructor(
    @InjectRepository(NotificationSchedule)
    private readonly repo: Repository<NotificationSchedule>,
    private readonly notificationService: PushNotificationService,
  ) {}

  async create(dto: CreateNotificationScheduleDto, userId: string): Promise<NotificationSchedule> {
    const ruleConfig = this.buildRuleConfigForCreate(dto);

    const schedule = this.repo.create({
      title: dto.title,
      body: dto.body,
      linkedEvent: dto.linkedEvent ?? null,
      linkTo: dto.linkTo,
      url: dto.url ?? null,
      target: dto.target,
      scheduleType: dto.scheduleType,
      ruleConfig,
      isActive: true,
      createdByUserId: userId,
    });
    return this.repo.save(schedule);
  }

  async findAll(filter: NotificationScheduleFilterDto): Promise<PaginatedResponse<NotificationSchedule>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;

    const [data, total] = await this.repo.findAndCount({
      ...(filter.isActive !== undefined ? { where: { isActive: filter.isActive } } : {}),
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }

  async findOne(id: string): Promise<NotificationSchedule> {
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) {
      throw new NotFoundException('Notificació programada no trobada');
    }
    return schedule;
  }

  /** Only a still-pending schedule can be edited — once it's fired or cancelled, `isActive` is
   *  false and this throws, same as `cancel`. */
  async update(id: string, dto: UpdateNotificationScheduleDto): Promise<NotificationSchedule> {
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) {
      throw new NotFoundException('Notificació programada no trobada');
    }
    if (!schedule.isActive) {
      throw new BadRequestException('Aquesta notificació ja no està activa');
    }

    // `dto.scheduleType` lets an edit switch ONE_OFF <-> WEEKLY, as long as the matching rule
    // config comes with it — validate against this "effective" type, not the schedule's current
    // (possibly about-to-change) one, or a legitimate type switch would look like a mismatch.
    const effectiveType = dto.scheduleType ?? schedule.scheduleType;

    if (dto.oneOff) {
      if (effectiveType !== NotificationScheduleType.ONE_OFF) {
        throw new BadRequestException("'oneOff' només és vàlid per a notificacions puntuals");
      }
      this.assertFutureDate(dto.oneOff.scheduledFor);
      schedule.ruleConfig = { scheduledFor: dto.oneOff.scheduledFor };
    }
    if (dto.weekly) {
      if (effectiveType !== NotificationScheduleType.WEEKLY) {
        throw new BadRequestException("'weekly' només és vàlid per a notificacions setmanals");
      }
      schedule.ruleConfig = this.buildWeeklyRuleConfig(dto.weekly);
    }

    if (dto.scheduleType !== undefined && dto.scheduleType !== schedule.scheduleType) {
      if (dto.scheduleType === NotificationScheduleType.ONE_OFF && !dto.oneOff) {
        throw new BadRequestException("Cal indicar 'oneOff' en canviar a notificació puntual");
      }
      if (dto.scheduleType === NotificationScheduleType.WEEKLY && !dto.weekly) {
        throw new BadRequestException("Cal indicar 'weekly' en canviar a notificació setmanal");
      }
      schedule.scheduleType = dto.scheduleType;
    }

    if (dto.title !== undefined) schedule.title = dto.title;
    if (dto.body !== undefined) schedule.body = dto.body;
    if (dto.linkedEvent !== undefined) schedule.linkedEvent = dto.linkedEvent;
    if (dto.linkTo !== undefined) schedule.linkTo = dto.linkTo;
    if (dto.url !== undefined) schedule.url = dto.url;
    if (dto.target !== undefined) schedule.target = dto.target;

    return this.repo.save(schedule);
  }

  async cancel(id: string): Promise<void> {
    const schedule = await this.repo.findOneBy({ id });
    if (!schedule) {
      throw new NotFoundException('Notificació programada no trobada');
    }
    if (!schedule.isActive) {
      throw new BadRequestException('Aquesta notificació ja no està activa');
    }
    await this.repo.update(id, { isActive: false });
  }

  /** "Send now" is a ONE_OFF schedule dispatched at the moment it's created, so every dispatch —
   *  immediate or future — goes through the same `processSchedule` executor. */
  async sendNow(dto: SendNotificationDto, userId: string): Promise<{ accepted: boolean; warning?: string }> {
    const schedule = await this.repo.save(
      this.repo.create({
        title: dto.title,
        body: dto.body,
        linkedEvent: dto.linkedEvent ?? null,
        linkTo: dto.linkTo,
        url: dto.url ?? null,
        target: dto.target,
        scheduleType: NotificationScheduleType.ONE_OFF,
        ruleConfig: { scheduledFor: new Date().toISOString() },
        isActive: true,
        createdByUserId: userId,
      }),
    );

    return this.processSchedule(schedule, NotificationSource.MANUAL);
  }

  async processSchedule(
    schedule: NotificationSchedule,
    source: NotificationSource,
  ): Promise<{ accepted: boolean; warning?: string }> {
    // ONE_OFF fires once, then deactivates. WEEKLY recurs — it stays active; the cron's own
    // "already fired today" check (via NotificationLog) is what stops it firing twice in a day.
    if (schedule.scheduleType === NotificationScheduleType.ONE_OFF) {
      await this.repo.update(schedule.id, { isActive: false });
    }

    const dto = Object.assign(new SendNotificationDto(), {
      title: schedule.title,
      body: schedule.body,
      linkedEvent: schedule.linkedEvent ?? undefined,
      linkTo: schedule.linkTo,
      url: schedule.url ?? undefined,
      target: schedule.target,
    });

    return this.notificationService.send(dto, {
      source,
      scheduleId: schedule.id,
      triggeredByUserId: schedule.createdByUserId ?? undefined,
    });
  }

  private assertFutureDate(scheduledFor: string): void {
    if (new Date(scheduledFor).getTime() <= Date.now()) {
      throw new BadRequestException('La data programada ha de ser al futur');
    }
  }

  private buildRuleConfigForCreate(dto: CreateNotificationScheduleDto): NotificationScheduleRuleConfig {
    if (dto.scheduleType === NotificationScheduleType.WEEKLY) {
      if (!dto.weekly) {
        throw new BadRequestException("Falta la configuració de programació ('weekly')");
      }
      return this.buildWeeklyRuleConfig(dto.weekly);
    }

    // Guaranteed ONE_OFF by CreateNotificationScheduleDto's validation — narrows dto.oneOff.
    if (!dto.oneOff) {
      throw new BadRequestException("Falta la configuració de programació ('oneOff')");
    }
    this.assertFutureDate(dto.oneOff.scheduledFor);
    return { scheduledFor: dto.oneOff.scheduledFor };
  }

  private buildWeeklyRuleConfig(weekly: WeeklyRuleConfigDto): WeeklyScheduleConfig {
    if (weekly.startDate && weekly.endDate && weekly.endDate < weekly.startDate) {
      throw new BadRequestException("'endDate' ha de ser posterior o igual a 'startDate'");
    }
    return {
      dayOfWeek: weekly.dayOfWeek,
      timeOfDay: weekly.timeOfDay,
      ...(weekly.startDate ? { startDate: weekly.startDate } : {}),
      ...(weekly.endDate ? { endDate: weekly.endDate } : {}),
    };
  }
}
