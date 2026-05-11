import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompositionSlot } from './composition-slot.entity';
import { FigureInstance } from '../../event-segment/entities/figure-instance.entity';

@Entity('composition_templates')
export class CompositionTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @OneToMany(() => CompositionSlot, (slot) => slot.composition, { cascade: true })
  slots: CompositionSlot[];

  @OneToMany(() => FigureInstance, (instance) => instance.compositionTemplate)
  instances: FigureInstance[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
