import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserRole } from '@muixer/shared';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateWithInviteDto } from './dto/create-with-invite.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { plainToInstance } from 'class-transformer';
import { USER_SORT_COLUMN_MAP } from './constants/user-sort.constants';
import { UserFilterDto } from './dto/user-filter.dto';

const BCRYPT_ROUNDS = 12;

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
      hasCredentials,
      search,
      sortBy,
      sortOrder = 'ASC',
      page = 1,
      limit = 25,
    } = filters;

    const qb = this.userRepository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.person', 'person');

    if (role && role.length > 0) {
      qb.andWhere('user.role IN (:...role)', { role });
    }

    if (isActive !== undefined) {
      qb.andWhere('user.isActive = :isActive', { isActive });
    }

    if (hasCredentials !== undefined) {
      if (hasCredentials) {
        qb.andWhere('user.passwordHash IS NOT NULL');
      } else {
        qb.andWhere('user.passwordHash IS NULL');
      }
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

  async createUser(dto: CreateUserDto): Promise<UserResponseDto> {
    if (dto.role === UserRole.MEMBER) {
      throw new BadRequestException(
        'Use create-with-invite endpoint for MEMBER users',
      );
    }

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['person'],
    });

    // If the email exists and already has a password (active account), reject.
    // If it exists without credentials (sync/invite stub), upgrade it instead.
    if (existingUser && existingUser.passwordHash) {
      throw new ConflictException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let person: Person | null = null;
    if (dto.personId) {
      person = await this.personRepository.findOne({
        where: { id: dto.personId },
        relations: ['managedBy'],
      });
      if (!person) throw new BadRequestException('Person not found');
      if (
        person.managedBy &&
        (!existingUser || person.managedBy.id !== existingUser.id)
      ) {
        throw new BadRequestException(
          'Person is already linked to another user',
        );
      }
    }

    let targetUser: User;

    if (existingUser) {
      // Upgrade the stub account: set credentials, role and activate
      existingUser.passwordHash = passwordHash;
      existingUser.role = dto.role;
      existingUser.isActive = true;
      existingUser.inviteToken = null;
      existingUser.inviteExpiresAt = null;
      if (person) existingUser.person = person;
      targetUser = await this.userRepository.save(existingUser);
    } else {
      const newUser = this.userRepository.create({
        email: dto.email,
        passwordHash,
        role: dto.role,
        isActive: true,
        ...(person ? { person } : {}),
      });
      targetUser = await this.userRepository.save(newUser);
    }

    if (person) {
      person.managedBy = targetUser;
      await this.personRepository.save(person);
    }

    const result = await this.userRepository.findOne({
      where: { id: targetUser.id },
      relations: ['person'],
    });
    return plainToInstance(UserResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new NotFoundException('User not found');

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('A user with this email already exists');
      }
      user.email = dto.email;
    }

    if (dto.role !== undefined) {
      user.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    if (dto.personId !== undefined) {
      if (dto.personId === null) {
        if (user.person) {
          const oldPerson = await this.personRepository.findOne({
            where: { id: user.person.id },
          });
          if (oldPerson) {
            oldPerson.managedBy = null;
            await this.personRepository.save(oldPerson);
          }
        }
        user.person = null;
      } else {
        const person = await this.personRepository.findOne({
          where: { id: dto.personId },
          relations: ['managedBy'],
        });
        if (!person) throw new BadRequestException('Person not found');
        if (person.managedBy && person.managedBy.id !== userId) {
          throw new BadRequestException(
            'Person is already linked to another user',
          );
        }
        user.person = person;
        person.managedBy = user;
        await this.personRepository.save(person);
      }
    }

    await this.userRepository.save(user);

    const result = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    return plainToInstance(UserResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }

  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');
    user.isActive = false;
    await this.userRepository.save(user);
  }
}
