import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Relation,
} from 'typeorm';
import type { User } from '../../user/user.entity';

@Entity('push_subscriptions')
@Index(['userId'])
@Index(['isActive', 'userId'])
export class PushSubscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne('User', { onDelete: 'CASCADE', nullable: false, eager: false })
  @JoinColumn({ name: 'user_id' })
  user: Relation<User>;

  @Column({ type: 'uuid', name: 'user_id' })
  userId: string;

  @Column({ type: 'varchar', length: 500, unique: true })
  endpoint: string;

  @Column({ type: 'jsonb' })
  keys: { p256dh: string; auth: string };

  @Column({ type: 'varchar', length: 255, nullable: true })
  userAgent: string | null;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
