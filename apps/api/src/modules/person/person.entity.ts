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
} from 'typeorm';
import { Gender, AvailabilityStatus, OnboardingStatus } from '@muixer/shared';
import { Position } from '../position/position.entity';
import { User } from '../user/user.entity';

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
  email: string | null;

  @Column({ type: 'varchar', nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'int', nullable: true })
  shoulderHeight: number | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ type: 'boolean', default: false })
  isXicalla: boolean;

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

  @Column({ type: 'date', nullable: true })
  shirtDate: Date | null;

  @Column({ type: 'date', nullable: true })
  joinDate: Date | null;

  @Column({ type: 'varchar', nullable: true })
  legacyId: string | null;

  @Column({ type: 'timestamp', nullable: true })
  lastSyncedAt: Date | null;

  @ManyToMany(() => Position)
  @JoinTable({ name: 'person_positions' })
  positions: Position[];

  @ManyToOne(() => User, { nullable: true })
  managedBy: User | null;

  @OneToOne(() => User, 'person', { nullable: true })
  user: User | null;

  @ManyToOne(() => Person, { nullable: true })
  mentor: Person | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
