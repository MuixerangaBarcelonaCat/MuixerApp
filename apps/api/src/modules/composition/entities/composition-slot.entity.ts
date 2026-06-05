import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CompositionTemplate } from './composition-template.entity';
import { FigureTemplate } from '../../figure/entities/figure-template.entity';

@Entity('composition_slots')
export class CompositionSlot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => CompositionTemplate, (composition) => composition.slots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  composition: CompositionTemplate;

  @ManyToOne(() => FigureTemplate, {
    nullable: false,
    onDelete: 'RESTRICT',
    eager: false,
  })
  @JoinColumn()
  figureTemplate: FigureTemplate;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'float', default: 0 })
  offsetX: number;

  @Column({ type: 'float', default: 0 })
  offsetY: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
