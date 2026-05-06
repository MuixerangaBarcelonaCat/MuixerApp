import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import crypto from 'crypto';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserRole } from '@muixer/shared';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateWithInviteDto} from './dto/create-with-invite.dto';
import { plainToInstance } from 'class-transformer';
import { USER_SORT_COLUMN_MAP } from './constants/user-sort.constants';
import { UserFilterDto } from './dto/user-filter.dto';

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

  async findOne(id: string): Promise<UserResponseDto | null> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: ['person'],
    });
    return plainToInstance(UserResponseDto, user, {
      excludeExtraneousValues: true,
    });
  }

  async findAll(
    filters: UserFilterDto,
  ): Promise<{ data: UserResponseDto[]; total: number }> {
    const {
      role,
      isActive,
      search,
      sortBy,
      sortOrder = 'ASC',
      page = 1,
      limit = 25,
    } = filters;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.person', 'person');

    if (role) {
      qb.andWhere('user.role = :role', { role });
    }

    if (isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive });
    }

    if (search) {
      qb.andWhere(
        `(
        unaccent(user.email) ILIKE unaccent(:search)
        OR unaccent(person.name) ILIKE unaccent(:search)
        OR unaccent(person.firstSurname) ILIKE unaccent(:search)
        OR unaccent(person.alias) ILIKE unaccent(:search)
      )`,
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    if (sortBy && USER_SORT_COLUMN_MAP[sortBy]) {
      qb.orderBy(USER_SORT_COLUMN_MAP[sortBy]!, sortOrder);
    } else {
      qb.orderBy('user.createdAt', 'DESC');
    }

    const users = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return {
      data: plainToInstance(UserResponseDto, users, {
        excludeExtraneousValues: true,
      }),
      total,
    };
  }

  async createWithInvite(dto: CreateWithInviteDto): Promise<UserResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id: dto.personId },
    });
    if (!person) throw new BadRequestException('Person not found');
    if (person.managedBy)
      throw new BadRequestException('Person is already managed by an user');
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
    return plainToInstance(UserResponseDto, createdUser, {
      excludeExtraneousValues: true,
    });
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

  async grantRole(userId: string, role: UserRole) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    user.role = role;
    await this.userRepository.save(user);
    const output = await this.userRepository.findOne({ where: { id: userId } , relations: ['person'] });
    return plainToInstance(UserResponseDto, output, {
      excludeExtraneousValues: true,
    });
  }
}
