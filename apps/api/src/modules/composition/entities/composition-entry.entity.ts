import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { FigureMode } from '@muixer/shared';
import { Composition } from './composition.entity';
import { FigureTemplate } from '../../figure/entities/figure-template.entity';

@Entity('composition_entries')
export class CompositionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Composition, (c) => c.entries, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  composition: Composition;

  @ManyToOne(() => FigureTemplate, { nullable: false, onDelete: 'RESTRICT', eager: false })
  @JoinColumn()
  figureTemplate: FigureTemplate;

  @Column({ type: 'varchar', nullable: true })
  label: string | null;

  @Column({ type: 'float', default: 0 })
  offsetX: number;

  @Column({ type: 'float', default: 0 })
  offsetY: number;

  @Column({ type: 'float', default: 0 })
  angle: number;

  @Column({ type: 'float', nullable: true })
  troncPanelX: number | null;

  @Column({ type: 'float', nullable: true })
  troncPanelY: number | null;

  @Column({ type: 'enum', enum: FigureMode, default: FigureMode.COMPLETA })
  figureMode: FigureMode;

  @Column({ type: 'int', nullable: true })
  numberOfCordons: number | null;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;
}
