import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { FigureZone } from '@muixer/shared';

@Entity('positions')
export class Position {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  shortDescription: string | null;

  @Column({ type: 'text', nullable: true })
  longDescription: string | null;

  @Column({ nullable: true })
  color: string | null;

  @Column({ type: 'enum', enum: FigureZone, nullable: true })
  zone: FigureZone | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
