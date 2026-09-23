import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import {
  EventReference,
  NotificationLinkType,
  NotificationScheduleRuleConfig,
  NotificationScheduleType,
  NotificationTarget,
} from '@muixer/shared';

/**
 * A notification to dispatch later. "Send now" is also modeled as a schedule (`scheduleType:
 * ONE_OFF`, `ruleConfig.scheduledFor` set to the moment of creation) so both origins share one
 * dispatch path — see `NotificationScheduleService.sendNow`/`processSchedule`.
 */
@Entity('notification_schedules')
export class NotificationSchedule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  title: string;

  @Column({ type: 'varchar', length: 500 })
  body: string;

  @Column({ type: 'jsonb', nullable: true })
  linkedEvent: EventReference | null;

  @Column({ type: 'enum', enum: NotificationLinkType, enumName: 'notification_schedules_link_to_enum' })
  linkTo: NotificationLinkType;

  @Column({ type: 'varchar', nullable: true })
  url: string | null;

  @Column({ type: 'jsonb' })
  target: NotificationTarget;

  @Column({ type: 'enum', enum: NotificationScheduleType, enumName: 'notification_schedules_schedule_type_enum' })
  scheduleType: NotificationScheduleType;

  @Column({ type: 'jsonb' })
  ruleConfig: NotificationScheduleRuleConfig;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
