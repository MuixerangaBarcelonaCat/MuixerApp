import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  JoinColumn,
} from 'typeorm';
import { EventSegment } from './event-segment.entity';
import { FigureTemplate } from '../../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../../composition/entities/composition-template.entity';

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
