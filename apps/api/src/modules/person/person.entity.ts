import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToMany,
  ManyToOne,
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

  @Column()
  name: string;

  @Column()
  firstSurname: string;

  @Column({ nullable: true })
  secondSurname: string | null;

  @Column({ length: 20, unique: true })
  alias: string;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'date', nullable: true })
  birthDate: Date | null;

  @Column({ type: 'int', nullable: true })
  shoulderHeight: number | null;

  @Column({ type: 'enum', enum: Gender, nullable: true })
  gender: Gender | null;

  @Column({ default: false })
  isXicalla: boolean;

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: false })
  isMember: boolean;

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

  @Column({ nullable: true })
  legacyId: string | null;

  @ManyToMany(() => Position)
  @JoinTable({ name: 'person_positions' })
  positions: Position[];

  @ManyToOne(() => User, { nullable: true })
  managedBy: User | null;

  @Column({ default: true })
  isMainAccount: boolean;

  @ManyToOne(() => Person, { nullable: true })
  mentor: Person | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
