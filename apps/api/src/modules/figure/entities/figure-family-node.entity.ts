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
import { FigureFamily } from './figure-family.entity';

/**
 * Stores TRONC and BASE nodes at the family level.
 * All variants of a FigureFamily share the same set of FigureFamilyNodes.
 * Invariant: zone is always TRONC or BASE.
 */
@Entity('figure_family_nodes')
export class FigureFamilyNode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureFamily, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  family: FigureFamily;

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

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
