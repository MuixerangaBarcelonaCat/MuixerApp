import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
import { NotificationSource, NotificationTarget } from '@muixer/shared';

/**
 * Append-only audit log of every notification actually dispatched (manual, one-off scheduled, or
 * recurring). No `updatedAt` on purpose — mirrors AuditLog's append-only shape.
 */
@Entity('notification_logs')
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  @Column({ type: 'jsonb' })
  target: NotificationTarget;

  /** Resolved target USERS at send time, not devices actually reached — see push-notification.service.ts `send()`. */
  @Column({ type: 'int' })
  recipientCount: number;

  @Column({ type: 'enum', enum: NotificationSource })
  source: NotificationSource;

  @Column({ type: 'uuid', nullable: true })
  scheduleId: string | null;

  @Column({ type: 'uuid', nullable: true })
  triggeredEventId: string | null;

  @Column({ type: 'uuid', nullable: true })
  triggeredByUserId: string | null;

  @Index()
  @CreateDateColumn({ type: 'timestamptz' })
  sentAt: Date;
}
