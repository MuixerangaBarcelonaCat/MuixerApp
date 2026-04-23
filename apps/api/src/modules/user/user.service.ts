import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';
import { UserRole } from '@muixer/shared';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(passwordHash: string, role: UserRole = UserRole.MEMBER): Promise<User> {
    const user = this.userRepository.create({
      passwordHash,
      role,
      isActive: false,
    });
    return this.userRepository.save(user);
  }

  async findOne(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  async setInviteToken(userId: string, token: string, expiresAt: Date): Promise<void> {
    await this.userRepository.update(userId, {
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    });
  }
}
