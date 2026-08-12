import {
  Injectable,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { Person } from '../person/person.entity';
import { User } from './user.entity';
import { UserRole } from '@muixer/shared';
import { UserResponseDto } from './dto/user-response.dto';
import { InviteLinkResponseDto } from './dto/invite-link-response.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { plainToInstance } from 'class-transformer';
import { USER_SORT_COLUMN_MAP } from './constants/user-sort.constants';
import { UserFilterDto } from './dto/user-filter.dto';
import { hashToken } from '../../common/utils/hash-token.util';
import { TokenService } from '../auth/token.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { INVITE_TOKEN_TTL_HOURS } from '../auth/constants/auth.constants';

const BCRYPT_ROUNDS = 12;

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    private readonly dataSource: DataSource,
    private readonly tokenService: TokenService,
    private readonly personDelegateService: PersonDelegateService,
    private readonly configService: ConfigService,
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

  /**
   * Creates (or reuses) the invite-holding User for a person and returns a fresh
   * activation link — no email is sent, the admin copies/forwards the link
   * themselves. Idempotent while the account is inactive: re-invoking regenerates
   * the token, which is what lets the dashboard button stay enabled instead of
   * graying out after first use.
   */
  async createOrRefreshInviteLink(personId: string): Promise<InviteLinkResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id: personId },
      relations: ['user'],
    });
    if (!person) throw new BadRequestException('Person not found');

    let user: User;
    if (!person.user) {
      user = await this.dataSource.transaction(async (manager) => {
        const newUser = manager.create(User, {
          email: null,
          role: UserRole.MEMBER,
          person,
          isActive: false,
        });
        const savedUser = await manager.save(User, newUser);
        await this.personDelegateService.demotePrimaryIfAny(person.id, manager);
        return savedUser;
      });
    } else if (person.user.isActive) {
      throw new BadRequestException('Aquesta persona ja té un compte actiu');
    } else {
      user = person.user;
    }

    const rawToken = crypto.randomBytes(16).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_TOKEN_TTL_HOURS);
    user.inviteToken = hashToken(rawToken);
    user.inviteExpiresAt = expiresAt;
    await this.userRepository.save(user);

    const protocol = this.configService.get<string>('NODE_ENV') === 'production' ? 'https' : 'http';
    const pwaSiteAddress = this.configService.get<string>('PWA_SITE_ADDRESS');
    const inviteUrl = `${protocol}://${pwaSiteAddress}/activate?token=${rawToken}`;

    return { inviteUrl, expiresAt: expiresAt.toISOString() };
  }

  async grantRole(userId: string, role: UserRole, actorId: string) {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new NotFoundException('User not found');

    if (userId === actorId && role !== user.role) {
      throw new ForbiddenException(
        'No us podeu canviar el vostre propi rol',
      );
    }

    user.role = role;
    const saved = await this.userRepository.save(user);
    return plainToInstance(UserResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async createUser(
    dto: CreateUserDto,
    actorRole: UserRole,
  ): Promise<UserResponseDto> {
    if (dto.role === UserRole.MEMBER) {
      throw new BadRequestException(
        'Use create-with-invite endpoint for MEMBER users',
      );
    }

    this.assertCanAssignRole(actorRole, UserRole.MEMBER, dto.role);

    const existingUser = await this.userRepository.findOne({
      where: { email: dto.email },
      relations: ['person'],
    });

    // If the email exists and already has a password (active account), reject.
    // If it exists without credentials (sync/invite stub), upgrade it instead.
    if (existingUser && existingUser.passwordHash) {
      throw new ConflictException('Ja existeix un usuari amb aquest email');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let person: Person | null = null;
    if (dto.personId) {
      person = await this.personRepository.findOne({
        where: { id: dto.personId },
        relations: ['user'],
      });
      if (!person) throw new BadRequestException('Person not found');
      if (
        person.user &&
        (!existingUser || person.user.id !== existingUser.id)
      ) {
        throw new BadRequestException(
          'Person is already linked to another user',
        );
      }
    }

    const result = await this.dataSource.transaction(async (manager) => {
      let targetUser: User;

      if (existingUser) {
        // Upgrade the stub account: set credentials, role and activate
        existingUser.passwordHash = passwordHash;
        existingUser.role = dto.role;
        existingUser.isActive = true;
        existingUser.inviteToken = null;
        existingUser.inviteExpiresAt = null;
        if (person) existingUser.person = person;
        targetUser = await manager.save(User, existingUser);
      } else {
        const newUser = manager.create(User, {
          email: dto.email,
          passwordHash,
          role: dto.role,
          isActive: true,
          ...(person ? { person } : {}),
        });
        targetUser = await manager.save(User, newUser);
      }

      if (person) {
        await this.personDelegateService.demotePrimaryIfAny(person.id, manager);
      }

      return manager.findOne(User, {
        where: { id: targetUser.id },
        relations: ['person'],
      });
    });

    return plainToInstance(UserResponseDto, result, {
      excludeExtraneousValues: true,
    });
  }

  async updateUser(
    userId: string,
    dto: UpdateUserDto,
    actorRole: UserRole,
    actorId: string,
  ): Promise<UserResponseDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.ADMIN && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solament un administrador pot modificar un compte ADMIN',
      );
    }

    if (dto.isActive === false && userId === actorId) {
      throw new ForbiddenException(
        'No us podeu desactivar el vostre propi compte',
      );
    }

    if (
      dto.role !== undefined &&
      dto.role !== user.role &&
      userId === actorId
    ) {
      throw new ForbiddenException('No us podeu canviar el vostre propi rol');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.userRepository.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('Ja existeix un usuari amb aquest email');
      }
      user.email = dto.email;
    }

    if (dto.role !== undefined) {
      this.assertCanAssignRole(actorRole, user.role, dto.role);
      user.role = dto.role;
    }

    if (dto.isActive !== undefined) {
      user.isActive = dto.isActive;
    }

    if (dto.personId !== undefined) {
      if (dto.personId === null) {
        user.person = null;
      } else {
        const person = await this.personRepository.findOne({
          where: { id: dto.personId },
          relations: ['user'],
        });
        if (!person) throw new BadRequestException('Person not found');
        if (person.user && person.user.id !== userId) {
          throw new BadRequestException(
            'Person is already linked to another user',
          );
        }
        user.person = person;
        await this.personDelegateService.demotePrimaryIfAny(person.id);
      }
    }

    const saved = await this.userRepository.save(user);

    if (dto.isActive === false) {
      await this.tokenService.revokeAllUserTokens(userId);
    }

    return plainToInstance(UserResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async deactivateUser(
    userId: string,
    actorRole: UserRole,
    actorId: string,
  ): Promise<void> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });
    if (!user) throw new NotFoundException('User not found');

    if (user.role === UserRole.ADMIN && actorRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solament un administrador pot modificar un compte ADMIN',
      );
    }

    if (userId === actorId) {
      throw new ForbiddenException(
        'No us podeu desactivar el vostre propi compte',
      );
    }

    user.isActive = false;
    await this.userRepository.save(user);
    await this.tokenService.revokeAllUserTokens(userId);
  }

  private assertCanAssignRole(
    actorRole: UserRole,
    targetCurrentRole: UserRole,
    newRole: UserRole,
  ): void {
    if (actorRole === UserRole.ADMIN) {
      return;
    }

    if (newRole === UserRole.ADMIN || targetCurrentRole === UserRole.ADMIN) {
      throw new ForbiddenException(
        'Solament un administrador pot assignar el rol d\'administrador',
      );
    }
  }
}
