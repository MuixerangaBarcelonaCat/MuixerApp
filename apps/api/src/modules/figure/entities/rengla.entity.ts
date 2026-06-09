import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
} from 'typeorm';
import { FigureTemplate } from './figure-template.entity';

@Entity('rengles')
export class Rengla {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureTemplate, (template) => template.rengles, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  template: FigureTemplate;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'int', default: 1 })
  startPosition: number;

  @Column({ type: 'boolean', default: false })
  allowsCordoObert: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
