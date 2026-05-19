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
import type { InstanceNode } from './instance-node.entity';

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

  /**
   * True once nodes have been snapshotted into InstanceNode rows on first assignment.
   * Until then, the instance is a lightweight reference to figureTemplate.
   */
  @Column({ type: 'boolean', default: false })
  snapshotted: boolean;

  /**
   * The variantOrder of the template at the time of snapshot.
   * Used by the upgrade operation to find which variant's nodes to add next.
   */
  @Column({ type: 'int', nullable: true })
  sourceVariantOrder: number | null;

  @OneToMany('InstanceNode', (node: InstanceNode) => node.figureInstance, { cascade: true })
  instanceNodes: InstanceNode[];

  @OneToMany('NodeAssignment', (a: NodeAssignment) => a.figureInstance, { cascade: true })
  assignments: NodeAssignment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
