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
import { Event } from '../../event/event.entity';
import { FigureInstance } from './figure-instance.entity';

@Entity('event_segments')
export class EventSegment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, (event) => event.segments, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  event: Event;

  @Column({ type: 'varchar', nullable: true })
  name: string | null;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'varchar', nullable: true })
  startTime: string | null;

  @Column({ type: 'varchar', nullable: true })
  endTime: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'boolean', default: false })
  isVisible: boolean;

  @OneToMany(() => FigureInstance, (instance) => instance.segment, { cascade: true })
  instances: FigureInstance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
