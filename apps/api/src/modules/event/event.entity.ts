import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EventType, AttendanceSummary, RehearsalMetadata, PerformanceMetadata } from '@muixer/shared';
import { Season } from '../season/season.entity';
import { Attendance } from './attendance.entity';

const DEFAULT_ATTENDANCE_SUMMARY: AttendanceSummary = {
  confirmed: 0,
  declined: 0,
  pending: 0,
  attended: 0,
  noShow: 0,
  lateCancel: 0,
  children: 0,
  total: 0,
};

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: EventType })
  eventType: EventType;

  @Column({ type: 'varchar' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'date' })
  date: Date;

  @Column({ type: 'varchar', nullable: true })
  startTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  location: string | null;

  @Column({ type: 'varchar', nullable: true })
  locationUrl: string | null;

  @Column({ type: 'text', nullable: true })
  information: string | null;

  @Column({ default: true })
  countsForStatistics: boolean;

  @Column({ type: 'jsonb', default: {} })
  metadata: RehearsalMetadata | PerformanceMetadata;

  @Column({ type: 'jsonb', default: DEFAULT_ATTENDANCE_SUMMARY })
  attendanceSummary: AttendanceSummary;

  @ManyToOne(() => Season, (season) => season.events, { nullable: true })
  @JoinColumn()
  season: Season | null;

  @OneToMany(() => Attendance, (attendance) => attendance.event)
  attendances: Attendance[];

  @Column({ type: 'varchar', nullable: true, unique: true })
  legacyId: string | null;

  @Column({ type: 'varchar', nullable: true })
  legacyType: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
