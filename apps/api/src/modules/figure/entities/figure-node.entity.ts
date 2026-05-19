import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FigureZone, NodeShape } from '@muixer/shared';
import { FigureTemplate } from './figure-template.entity';

@Entity('figure_nodes')
export class FigureNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureTemplate, (template) => template.nodes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  template: FigureTemplate;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'enum', enum: FigureZone })
  zone: FigureZone;

  @Column({ type: 'varchar', nullable: true })
  positionType: string | null;

  @Column({ type: 'float' })
  x: number;

  @Column({ type: 'float' })
  y: number;

  @Column({ type: 'int', default: 0 })
  z: number;

  @Column({ type: 'float' })
  width: number;

  @Column({ type: 'float' })
  height: number;

  @Column({ type: 'float', default: 0 })
  rotation: number;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'enum', enum: NodeShape })
  shape: NodeShape;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', nullable: true })
  climbPath: string | null;

  /** Concentric ring this node belongs to (1 = innermost). NULL for non-pinya zones. */
  @Column({ type: 'int', nullable: true })
  ringLevel: number | null;

  /**
   * Root ancestor node ID — set when this node is derived from another template variant.
   * Always traces back to the original node in the first variant (not the immediate parent).
   * Informational only; not a FK constraint.
   */
  @Column({ type: 'uuid', nullable: true })
  originNodeId: string | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
