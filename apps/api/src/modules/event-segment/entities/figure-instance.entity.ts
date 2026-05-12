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
import { EventSegment } from './event-segment.entity';
import { FigureTemplate } from '../../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../../composition/entities/composition-template.entity';
import type { NodeAssignment } from '../../node-assignment/entities/node-assignment.entity';

@Entity('figure_instances')
export class FigureInstance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => EventSegment, (segment) => segment.instances, { onDelete: 'CASCADE', nullable: false })
  @JoinColumn()
  segment: EventSegment;

  @ManyToOne(() => FigureTemplate, (template) => template.instances, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn()
  figureTemplate: FigureTemplate | null;

  @ManyToOne(() => CompositionTemplate, (composition) => composition.instances, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn()
  compositionTemplate: CompositionTemplate | null;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'int' })
  sortOrder: number;

  @OneToMany('NodeAssignment', (a: NodeAssignment) => a.figureInstance, { cascade: true })
  assignments: NodeAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
