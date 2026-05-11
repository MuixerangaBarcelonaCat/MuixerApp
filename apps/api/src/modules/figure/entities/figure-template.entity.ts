import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FigureNode } from './figure-node.entity';
import { FigureInstance } from '../../event-segment/entities/figure-instance.entity';

@Entity('figure_templates')
export class FigureTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: true })
  hasPinya: boolean;

  @Column({ type: 'float', default: 0 })
  direction: number;

  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, unknown>;

  @OneToMany(() => FigureNode, (node) => node.template, { cascade: true })
  nodes: FigureNode[];

  @OneToMany(() => FigureInstance, (instance) => instance.figureTemplate)
  instances: FigureInstance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
