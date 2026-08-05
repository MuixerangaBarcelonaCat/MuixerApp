import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction } from '@muixer/shared';
import { AuditLog } from './audit-log.entity';

export interface AuditRecordParams {
  actorUserId?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Append a security-activity entry. Never throws: audit logging must not break the primary
   * operation it observes (consent, sensitive-data access). Failures are logged and swallowed.
   */
  async record(params: AuditRecordParams): Promise<void> {
    try {
      const entry = this.repo.create({
        actorUserId: params.actorUserId ?? null,
        action: params.action,
        targetType: params.targetType ?? null,
        targetId: params.targetId ?? null,
        metadata: params.metadata ?? null,
        ipAddress: params.ipAddress ?? null,
      });
      await this.repo.save(entry);
    } catch (error) {
      this.logger.error(`Failed to write audit log (${params.action})`, error as Error);
    }
  }
}
