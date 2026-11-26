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
  isPublished: boolean;

  @OneToMany(() => FigureInstance, (instance) => instance.segment, { cascade: true })
  instances: FigureInstance[];

  /** Bumped by DB triggers on node/assignment writes. Never written by TypeORM. */
  @Column({ type: 'int', default: 0, insert: false, update: false })
  revision: number;

  /** Bumped by DB triggers on figure/segment/unsnapshotted-template writes. Never written by TypeORM. */
  @Column({ type: 'int', default: 0, insert: false, update: false })
  structureRevision: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
