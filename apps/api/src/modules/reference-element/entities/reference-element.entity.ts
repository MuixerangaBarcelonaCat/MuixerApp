import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../../event/event.entity';
import { ReferenceElementType } from '@muixer/shared';

@Entity('reference_elements')
export class ReferenceElement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Event, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  event: Event;

  @Column({ type: 'enum', enum: ReferenceElementType })
  type: ReferenceElementType;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'float' })
  x: number;

  @Column({ type: 'float' })
  y: number;

  @Column({ type: 'float' })
  width: number;

  @Column({ type: 'float' })
  height: number;

  @Column({ type: 'float', default: 0 })
  rotation: number;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'jsonb', default: [] })
  hiddenInSegments: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
