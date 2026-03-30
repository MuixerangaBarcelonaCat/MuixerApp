import { Entity, PrimaryGeneratedColumn, Column, OneToMany, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { UserRole } from '@muixer/shared';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  passwordHash: string;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.MEMBER })
  role: UserRole;

  @Column({ default: false })
  isActive: boolean;

  @Column({ nullable: true })
  inviteToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  inviteExpiresAt: Date | null;

  @Column({ nullable: true })
  resetToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  resetExpiresAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
