import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FigureFamily } from './figure-family.entity';
import { FigureNode } from './figure-node.entity';
import { Rengla } from './rengla.entity';
import { FigureInstance } from '../../event-segment/entities/figure-instance.entity';

@Entity('figure_templates')
export class FigureTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureFamily, (family) => family.templates, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  family: FigureFamily | null;

  @Column({ type: 'int', default: 1 })
  variantOrder: number;

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

  @OneToMany(() => Rengla, (rengla) => rengla.template, { cascade: true })
  rengles: Rengla[];

  @OneToMany(() => FigureInstance, (instance) => instance.figureTemplate)
  instances: FigureInstance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
