import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('positions')
export class Tag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'varchar', nullable: true })
  shortDescription: string | null;

  @Column({ type: 'text', nullable: true })
  longDescription: string | null;

  @Column({ type: 'varchar', nullable: true })
  color: string | null;

  @Column({ type: 'text', array: true, default: '{}' })
  positionTypes: string[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
