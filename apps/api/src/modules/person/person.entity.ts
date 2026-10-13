import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  ManyToOne,
  OneToOne,
  JoinTable,
  CreateDateColumn,
  UpdateDateColumn,
  Relation,
  VirtualColumn,
} from 'typeorm';
import { Gender, AvailabilityStatus, OnboardingStatus } from '@muixer/shared';
import { Tag } from '../tag/tag.entity';
import { User } from '../user/user.entity';
import { xicallaSql } from './xicalla.sql';

@Entity('persons')
export class Person {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar' })
  firstSurname: string;

  @Column({ type: 'varchar', nullable: true })
  secondSurname: string | null;

  @Column({ type: 'varchar', length: 20, unique: true })
  alias: string;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'int', nullable: true })
  shoulderHeight: number | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  /** Xicalla set by hand: only counts while `birthDate` is unknown. Write this, never `isXicalla`. */
  @Column({ type: 'boolean', default: false })
  isXicallaManual: boolean;

  /**
   * Effective xicalla, worked out on read (`xicallaSql`): by age when `birthDate` is known,
   * otherwise `isXicallaManual`. TypeORM never writes a virtual column, so it is `readonly`; it is
   * also not refreshed by `save()` — re-read the person, or use `deriveIsXicalla`, after a write.
   */
  @VirtualColumn({ type: 'boolean', query: (alias) => xicallaSql(alias) })
  readonly isXicalla: boolean;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'boolean', default: false })
  isMember: boolean;

  @Column({ type: 'boolean', default: false })
  isProvisional: boolean;

  @Column({ type: 'enum', enum: AvailabilityStatus, default: AvailabilityStatus.AVAILABLE })
  availability: AvailabilityStatus;

  @Column({ type: 'enum', enum: OnboardingStatus, default: OnboardingStatus.NOT_APPLICABLE })
  onboardingStatus: OnboardingStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 16, nullable: true })
  notesEmoji: string | null;

  @Column({ type: 'date', nullable: true })
  shirtDate: Date | null;

  @Column({ type: 'date', nullable: true })
  joinDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  legacyId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  lastSyncedAt: Date | null;

  @ManyToMany(() => Tag)
  @JoinTable({ name: 'person_positions' })
  positions: Tag[];

  /** Pure inverse of `User.person` — no column here, resolved via a join on `users.person_id`. */
  @OneToOne(() => User, (user) => user.person)
  user: Relation<User> | null;

  @ManyToOne(() => Person, { nullable: true })
  mentor: Person | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
