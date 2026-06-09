import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { FigureZone, NodeShape } from '@muixer/shared';
import type { FigureInstance } from './figure-instance.entity';

/**
 * Snapshot copy of a FigureNode, owned by a FigureInstance.
 * Created in bulk when the first NodeAssignment is made on an instance (lazy snapshot).
 * After snapshot, changes to the source FigureTemplate do NOT affect these rows.
 */
@Entity('instance_nodes')
export class InstanceNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('FigureInstance', (instance: FigureInstance) => instance.instanceNodes, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  figureInstance: FigureInstance;

  /**
   * The original FigureNode.id at the time of snapshot. Stored as a plain UUID
   * (not a FK) so it survives template node deletions without breaking integrity.
   */
  @Column({ type: 'uuid', nullable: true })
  sourceNodeId: string | null;

  /**
   * Root ancestor node ID, copied from FigureNode.originNodeId at snapshot time.
   * Used for upgrade matching: canonical ID = originNodeId ?? sourceNodeId.
   */
  @Column({ type: 'uuid', nullable: true })
  originNodeId: string | null;

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

  @Column({ type: 'int', nullable: true })
  ringLevel: number | null;

  /** Copied from source FigureNode at snapshot time. */
  @Column({ type: 'uuid', nullable: true })
  renglaId: string | null;

  /** Copied from source FigureNode at snapshot time. */
  @Column({ type: 'int', nullable: true })
  renglaPosition: number | null;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;
}
