import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
  JoinColumn,
} from 'typeorm';
import { AttendanceStatus } from '@muixer/shared';
import { Person } from '../person/person.entity';
import { Event } from './event.entity';

@Entity('attendances')
@Unique(['person', 'event'])
export class Attendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: AttendanceStatus })
  status: AttendanceStatus;

  @Column({ type: 'timestamp', nullable: true })
  respondedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @ManyToOne(() => Person, { nullable: false, eager: false })
  @JoinColumn()
  person: Person;

  @ManyToOne(() => Event, (event) => event.attendances, { nullable: false, eager: false })
  @JoinColumn()
  event: Event;

  @Column({ type: 'varchar', nullable: true })
  legacyId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
