import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Tag } from '../tag/tag.entity';

/**
 * The colla's own parameters. A single row: the migration seeds it and a unique index on a
 * constant refuses a second one. Flat columns so the database can check each value; the API
 * exposes them nested as `CollaSettings` (see `toCollaSettings`).
 */
@Entity('colla_settings')
export class CollaSettingsEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100 })
  collaName: string;

  @Column({ type: 'int' })
  shirtRequiredPerformances: number;

  @Column({ type: 'int' })
  shirtRequiredRehearsals: number;

  @Column({ type: 'int' })
  shoulderHeightBaselineCm: number;

  @Column({ type: 'int' })
  troncFloorWarningCm: number;

  @Column({ type: 'int' })
  troncFloorErrorCm: number;

  @Column({ type: 'int' })
  troncSupportWarningCm: number;

  @Column({ type: 'int' })
  troncSupportErrorCm: number;

  @Column({ type: 'int' })
  assignmentLockDays: number;

  @Column({ type: 'boolean' })
  autoCheckInPerformances: boolean;

  @Column({ type: 'uuid', nullable: true })
  defaultTagId: string | null;

  @ManyToOne(() => Tag, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'defaultTagId' })
  defaultTag?: Tag | null;

  @Column({ type: 'int' })
  majorityAge: number;

  @Column({ type: 'varchar', length: 200 })
  rehearsalDefaultTitle: string;

  /** `HH:mm`. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  rehearsalDefaultStartTime: string | null;

  @Column({ type: 'varchar', length: 200 })
  rehearsalDefaultLocation: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  rehearsalDefaultLocationUrl: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
