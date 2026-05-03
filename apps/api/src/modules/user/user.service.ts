import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import crypto from 'crypto';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserRole } from '@muixer/shared';
import { CreateWithInviteDto} from './dto/create-with-invite.dto';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async create(
    passwordHash: string,
    role: UserRole = UserRole.MEMBER,
  ): Promise<User> {
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

  async createWithInvite(
    dto: CreateWithInviteDto
  ) {
    const person = await this.personRepository.findOne({ where: { id: dto.personId } });
    if (!person) throw new BadRequestException('Person not found');
    if (person.managedBy) throw new BadRequestException('Person is already managed by an user');
    const user = this.userRepository.create({
      email: dto.email,
      role: UserRole.MEMBER,
      person,
      isActive: false,
    });
    const createdUser = await this.userRepository.save(user);
    person.managedBy = createdUser;
    await this.personRepository.save(person);
    await this.sendInvite(user.id);
    return createdUser;
  }

  async sendInvite(userId: string, tokenDurationHours = 72): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new UnauthorizedException();
    if (user.isActive) throw new BadRequestException('User is already active');
    const inviteToken = crypto.randomBytes(16).toString('hex');
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + tokenDurationHours);
    user.inviteToken = inviteToken;
    user.inviteExpiresAt = expirationDate;
    await this.userRepository.save(user);

    this.sendInvitationEmail(user.email, inviteToken).catch((err) => {
      throw new BadRequestException('Failed to send invite email');
    });
  }

  async sendInvitationEmail(email: string, inviteToken: string): Promise<void> {
    const message =
      'Here we would send an email to ' + email + ' with token ' + inviteToken;
    console.log(message);
    // TODO implement
  }
}
