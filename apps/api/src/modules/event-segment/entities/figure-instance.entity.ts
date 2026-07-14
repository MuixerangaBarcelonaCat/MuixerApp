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
import type { NodeAssignment } from '../../node-assignment/entities/node-assignment.entity';
import type { InstanceNode } from './instance-node.entity';
import { FigureMode } from '@muixer/shared';

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

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'int' })
  sortOrder: number;

  @Column({ type: 'enum', enum: FigureMode, default: FigureMode.COMPLETA })
  figureMode: FigureMode;

  /**
   * True once nodes have been snapshotted into InstanceNode rows on first assignment.
   * Until then, the instance is a lightweight reference to figureTemplate.
   */
  @Column({ type: 'boolean', default: false })
  snapshotted: boolean;

  /** How many cordons to show. NULL = all visible. */
  @Column({ type: 'int', nullable: true })
  numberOfCordons: number | null;

  /** Whether cordo-obert nodes are shown/assignable for this instance. */
  @Column({ type: 'boolean', default: true })
  cordonsObertsEnabled: boolean;

  @Column({ type: 'float', nullable: true })
  projectionX: number | null;

  @Column({ type: 'float', nullable: true })
  projectionY: number | null;

  @Column({ type: 'float', default: 1.0 })
  projectionScale: number;

  @Column({ type: 'float', nullable: true })
  projectionAngle: number | null;

  @Column({ type: 'float', nullable: true })
  troncPanelX: number | null;

  @Column({ type: 'float', nullable: true })
  troncPanelY: number | null;

  @Column({ type: 'float', nullable: true })
  troncPanelWidth: number | null;

  @Column({ type: 'float', nullable: true })
  troncPanelHeight: number | null;

  @OneToMany('InstanceNode', (node: InstanceNode) => node.figureInstance, { cascade: true })
  instanceNodes: InstanceNode[];

  @OneToMany('NodeAssignment', (a: NodeAssignment) => a.figureInstance, { cascade: true })
  assignments: NodeAssignment[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
