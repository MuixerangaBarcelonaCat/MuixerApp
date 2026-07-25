import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { DelegateType } from '@muixer/shared';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';

@Entity('person_delegates')
@Unique(['user', 'person'])
export class PersonDelegate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { nullable: false })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Person, { nullable: false })
  @JoinColumn({ name: 'person_id' })
  person: Person;

  @Column({ type: 'enum', enum: DelegateType })
  delegateType: DelegateType;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
