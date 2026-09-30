import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationSource, NotificationTarget, PaginatedResponse } from '@muixer/shared';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationLogFilterDto } from './dto/notification-log-filter.dto';

export interface NotificationLogRecordParams {
  title: string;
  body: string;
  url?: string | null;
  target: NotificationTarget;
  recipientCount: number;
  source: NotificationSource;
  scheduleId?: string | null;
  triggeredEventId?: string | null;
  triggeredByUserId?: string | null;
}

@Injectable()
export class NotificationLogService {
  private readonly logger = new Logger(NotificationLogService.name);

  constructor(
    @InjectRepository(NotificationLog)
    private readonly repo: Repository<NotificationLog>,
  ) {}

  /**
   * Append a notification-history entry. Never throws: logging must not break the actual send it
   * observes. Failures are logged and swallowed.
   */
  async record(params: NotificationLogRecordParams): Promise<void> {
    try {
      const entry = this.repo.create({
        title: params.title,
        body: params.body,
        url: params.url ?? null,
        target: params.target,
        recipientCount: params.recipientCount,
        source: params.source,
        scheduleId: params.scheduleId ?? null,
        triggeredEventId: params.triggeredEventId ?? null,
        triggeredByUserId: params.triggeredByUserId ?? null,
      });
      await this.repo.save(entry);
    } catch (error) {
      this.logger.error('Failed to write notification log', error as Error);
    }
  }

  async findAll(filter: NotificationLogFilterDto): Promise<PaginatedResponse<NotificationLog>> {
    const page = filter.page ?? 1;
    const limit = filter.limit ?? 25;

    const [data, total] = await this.repo.findAndCount({
      ...(filter.source ? { where: { source: filter.source } } : {}),
      order: { sentAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, meta: { total, page, limit } };
  }
}
