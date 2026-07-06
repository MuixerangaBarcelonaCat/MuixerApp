import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Person } from '../person/person.entity';
import { UserRole } from '@muixer/shared';

const makeTransactionManager = () => ({
  create: jest.fn((_entity: unknown, data: unknown) => data),
  save: jest.fn((_entity: unknown, data: unknown) => Promise.resolve(data)),
  findOne: jest.fn(),
});

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed-password'),
}));

const makePerson = (overrides: Partial<Person> = {}): Person =>
  ({
    id: 'person-uuid',
    alias: 'jdoe',
    name: 'John',
    firstSurname: 'Doe',
    secondSurname: null,
    managedBy: null,
    ...overrides,
  }) as Person;

const makeUser = (overrides: Partial<User> = {}): User =>
  ({
    id: 'user-uuid',
    email: 'john@example.com',
    passwordHash: 'hashed',
    role: UserRole.MEMBER,
    isActive: true,
    inviteToken: null,
    inviteExpiresAt: null,
    person: makePerson(),
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }) as User;

describe('UserService', () => {
  let service: UserService;
  let userQb: Record<string, jest.Mock>;
  let mockUserRepo: Record<string, jest.Mock>;
  let mockPersonRepo: Record<string, jest.Mock>;
  let mockDataSource: { transaction: jest.Mock };

  beforeEach(async () => {
    userQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockUserRepo = {
      createQueryBuilder: jest.fn(() => userQb),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    };

    mockPersonRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
    };

    mockDataSource = {
      transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    // Prevent actual email sending in all tests
    jest.spyOn(service, 'sendInvitationEmail').mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // findAll
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('joins person relation', async () => {
      await service.findAll({});
      expect(userQb.leftJoinAndSelect).toHaveBeenCalledWith('user.person', 'person');
    });

    it('applies role filter', async () => {
      await service.findAll({ role: [UserRole.ADMIN] });
      expect(userQb.andWhere).toHaveBeenCalledWith('user.role IN (:...role)', { role: [UserRole.ADMIN] });
    });

    it('applies isActive=true filter', async () => {
      await service.findAll({ isActive: true });
      expect(userQb.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: true });
    });

    it('applies isActive=false filter', async () => {
      await service.findAll({ isActive: false });
      expect(userQb.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: false });
    });

    it('does not apply isActive filter when undefined', async () => {
      await service.findAll({});
      const calls: string[] = userQb.andWhere.mock.calls.map((c: unknown[]) => c[0] as string);
      expect(calls.some((c) => c.includes('isActive'))).toBe(false);
    });

    it('applies search filter with ILIKE on email, name, firstSurname and alias', async () => {
      await service.findAll({ search: 'john' });
      expect(userQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%john%' },
      );
      const searchArg: string = userQb.andWhere.mock.calls.find(
        (c: unknown[]) => typeof c[1] === 'object' && (c[1] as Record<string, unknown>).search,
      )[0] as string;
      expect(searchArg).toContain('user.email');
      expect(searchArg).toContain('person.name');
      expect(searchArg).toContain('person.firstSurname');
      expect(searchArg).toContain('person.alias');
    });

    it('wraps search term with % wildcards', async () => {
      await service.findAll({ search: 'doe' });
      const searchCall = userQb.andWhere.mock.calls.find(
        (c: unknown[]) => typeof c[1] === 'object' && (c[1] as Record<string, unknown>).search,
      );
      expect(searchCall[1]).toEqual({ search: '%doe%' });
    });

    it('defaults to createdAt DESC when no sortBy given', async () => {
      await service.findAll({});
      expect(userQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'DESC');
    });

    it('sorts by email ASC', async () => {
      await service.findAll({ sortBy: 'email', sortOrder: 'ASC' });
      expect(userQb.orderBy).toHaveBeenCalledWith('user.email', 'ASC');
    });

    it('sorts by role DESC', async () => {
      await service.findAll({ sortBy: 'role', sortOrder: 'DESC' });
      expect(userQb.orderBy).toHaveBeenCalledWith('user.role', 'DESC');
    });

    it('sorts by isActive', async () => {
      await service.findAll({ sortBy: 'isActive', sortOrder: 'ASC' });
      expect(userQb.orderBy).toHaveBeenCalledWith('user.isActive', 'ASC');
    });

    it('sorts by createdAt', async () => {
      await service.findAll({ sortBy: 'createdAt', sortOrder: 'ASC' });
      expect(userQb.orderBy).toHaveBeenCalledWith('user.createdAt', 'ASC');
    });

    it('sorts by alias using the person join alias, not a three-segment path', async () => {
      await service.findAll({ sortBy: 'alias', sortOrder: 'ASC' });
      expect(userQb.orderBy).toHaveBeenCalledWith('person.alias', 'ASC');
    });

    it('applies pagination — skip and take', async () => {
      await service.findAll({ page: 3, limit: 10 });
      expect(userQb.skip).toHaveBeenCalledWith(20);
      expect(userQb.take).toHaveBeenCalledWith(10);
    });

    it('uses default page=1 and limit=25', async () => {
      await service.findAll({});
      expect(userQb.skip).toHaveBeenCalledWith(0);
      expect(userQb.take).toHaveBeenCalledWith(25);
    });

    it('returns mapped UserResponseDto array', async () => {
      userQb.getCount.mockResolvedValue(1);
      userQb.getMany.mockResolvedValue([makeUser()]);

      const result = await service.findAll({});

      expect(result.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('user-uuid');
      expect(result.data[0].email).toBe('john@example.com');
    });

    it('does not expose passwordHash in returned data', async () => {
      userQb.getMany.mockResolvedValue([makeUser()]);
      const result = await service.findAll({});
      expect((result.data[0] as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('counts before applying sort and pagination', async () => {
      const callOrder: string[] = [];
      userQb.getCount.mockImplementation(() => { callOrder.push('getCount'); return Promise.resolve(0); });
      userQb.orderBy.mockImplementation(() => { callOrder.push('orderBy'); return userQb; });
      userQb.skip.mockImplementation(() => { callOrder.push('skip'); return userQb; });

      await service.findAll({});

      expect(callOrder.indexOf('getCount')).toBeLessThan(callOrder.indexOf('orderBy'));
      expect(callOrder.indexOf('getCount')).toBeLessThan(callOrder.indexOf('skip'));
    });
  });

  // ---------------------------------------------------------------------------
  // findOne
  // ---------------------------------------------------------------------------

  describe('findOne', () => {
    it('returns null when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      const result = await service.findOne('missing-id');
      // plainToInstance on null returns an empty DTO — service returns it as-is
      expect(result).toBeDefined();
    });

    it('returns UserResponseDto with person relation', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.findOne('user-uuid');
      expect(result!.id).toBe('user-uuid');
      expect(result!.person).not.toBeNull();
      expect(result!.person!.alias).toBe('jdoe');
    });

    it('does not expose passwordHash', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.findOne('user-uuid');
      expect((result as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('queries with person relation', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser());
      await service.findOne('user-uuid');
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        relations: ['person'],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createWithInvite
  // ---------------------------------------------------------------------------

  describe('createWithInvite', () => {
    it('throws BadRequestException when person not found', async () => {
      mockPersonRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createWithInvite({ personId: 'bad-id', email: 'x@x.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when person already has a managedBy user', async () => {
      const person = makePerson({ managedBy: makeUser() });
      mockPersonRepo.findOne.mockResolvedValue(person);
      await expect(
        service.createWithInvite({ personId: 'person-uuid', email: 'x@x.com' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates user with MEMBER role and isActive=false', async () => {
      const person = makePerson({ managedBy: null });
      mockPersonRepo.findOne.mockResolvedValue(person);

      const createdUser = makeUser({ isActive: false, person });
      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(createdUser); // user save
      mockDataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      // no email conflict, then sendInvite's internal findOne
      mockUserRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...createdUser, isActive: false });

      const result = await service.createWithInvite({ personId: 'person-uuid', email: 'new@user.com' });

      expect(manager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ role: UserRole.MEMBER, isActive: false }),
      );
      expect(result.isActive).toBe(false);
    });

    it('associates person to created user, atomically with the user creation', async () => {
      const person = makePerson({ managedBy: null });
      mockPersonRepo.findOne.mockResolvedValue(person);

      const createdUser = makeUser({ isActive: false, person });
      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(createdUser); // user save
      mockDataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));
      mockUserRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...createdUser, isActive: false });

      await service.createWithInvite({ personId: 'person-uuid', email: 'new@user.com' });

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledWith(
        Person,
        expect.objectContaining({ managedBy: createdUser }),
      );
    });

    it('throws ConflictException when email already exists', async () => {
      const person = makePerson({ managedBy: null });
      mockPersonRepo.findOne.mockResolvedValue(person);
      mockUserRepo.findOne.mockResolvedValueOnce(makeUser({ email: 'taken@user.com' }));

      await expect(
        service.createWithInvite({ personId: 'person-uuid', email: 'taken@user.com' }),
      ).rejects.toThrow(ConflictException);

      expect(mockUserRepo.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // sendInvite
  // ---------------------------------------------------------------------------

  describe('sendInvite', () => {
    it('throws UnauthorizedException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.sendInvite('missing-id')).rejects.toThrow(UnauthorizedException);
    });

    it('throws BadRequestException when user is already active', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser({ isActive: true }));
      await expect(service.sendInvite('user-uuid')).rejects.toThrow(BadRequestException);
    });

    it('sets inviteToken and inviteExpiresAt on the user', async () => {
      const user = makeUser({ isActive: false, inviteToken: null, inviteExpiresAt: null });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue(user);

      await service.sendInvite('user-uuid');

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteToken: expect.any(String),
          inviteExpiresAt: expect.any(Date),
        }),
      );
    });

    it('sets expiration ~72h in the future by default', async () => {
      const user = makeUser({ isActive: false });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockImplementation(async (u: User) => u);

      const before = Date.now();
      await service.sendInvite('user-uuid');
      const after = Date.now();

      const savedUser = mockUserRepo.save.mock.calls[0][0] as User;
      const expiry = savedUser.inviteExpiresAt!.getTime();
      const expectedMs = 72 * 60 * 60 * 1000;

      expect(expiry).toBeGreaterThanOrEqual(before + expectedMs - 1000);
      expect(expiry).toBeLessThanOrEqual(after + expectedMs + 1000);
    });

    it('rejects with BadRequestException when sendInvitationEmail fails, instead of resolving', async () => {
      const user = makeUser({ isActive: false });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue(user);
      jest
        .spyOn(service, 'sendInvitationEmail')
        .mockRejectedValue(new Error('SMTP down'));

      await expect(service.sendInvite('user-uuid')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // grantRole
  // ---------------------------------------------------------------------------

  describe('grantRole', () => {
    it('throws NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        service.grantRole('missing-id', UserRole.ADMIN, 'actor-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates the role and returns UserResponseDto', async () => {
      const user = makeUser({ role: UserRole.MEMBER });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, role: UserRole.ADMIN });

      const result = await service.grantRole('user-uuid', UserRole.ADMIN, 'actor-uuid');

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('does not expose passwordHash after role grant', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue(user);

      const result = await service.grantRole('user-uuid', UserRole.ADMIN, 'actor-uuid');
      expect((result as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });

    it('throws ForbiddenException when an ADMIN actor grants themselves a different role', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(
        service.grantRole('user-uuid', UserRole.TECHNICAL, 'user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('loads the person relation up front and does not re-fetch after saving', async () => {
      const user = makeUser({ role: UserRole.MEMBER });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, role: UserRole.ADMIN });

      await service.grantRole('user-uuid', UserRole.ADMIN, 'actor-uuid');

      expect(mockUserRepo.findOne).toHaveBeenCalledTimes(1);
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'user-uuid' },
        relations: ['person'],
      });
    });
  });

  // ---------------------------------------------------------------------------
  // createUser
  // ---------------------------------------------------------------------------

  describe('createUser', () => {
    const createDto = {
      email: 'tech@example.com',
      password: 'securepass123',
      role: UserRole.TECHNICAL,
    };

    it('throws BadRequestException when role is MEMBER', async () => {
      await expect(
        service.createUser({ ...createDto, role: UserRole.MEMBER }, UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException when email already exists with credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue(makeUser({ passwordHash: 'existing-hash' }));
      await expect(service.createUser(createDto, UserRole.ADMIN)).rejects.toThrow(
        ConflictException,
      );
    });

    it('upgrades a credential-less stub account (from sync/invite) instead of rejecting', async () => {
      const stubUser = makeUser({ passwordHash: null as unknown as string, isActive: false, role: UserRole.MEMBER });
      mockUserRepo.findOne.mockResolvedValueOnce(stubUser); // email check finds stub

      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce({ ...stubUser, role: UserRole.TECHNICAL, isActive: true }); // user save
      manager.findOne.mockResolvedValueOnce({
        ...stubUser,
        role: UserRole.TECHNICAL,
        isActive: true,
        passwordHash: 'hashed-password',
      }); // reload
      mockDataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const result = await service.createUser(createDto, UserRole.ADMIN);

      expect(manager.save).toHaveBeenCalledWith(
        User,
        expect.objectContaining({ role: UserRole.TECHNICAL, isActive: true }),
      );
      expect(result.role).toBe(UserRole.TECHNICAL);
      expect(result.isActive).toBe(true);
    });

    it('throws BadRequestException when personId is invalid', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null); // email check
      mockPersonRepo.findOne.mockResolvedValue(null);
      await expect(
        service.createUser({ ...createDto, personId: 'bad-id' }, UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when person is already linked', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null); // email check
      mockPersonRepo.findOne.mockResolvedValue(
        makePerson({ managedBy: makeUser({ id: 'other-user' }) }),
      );
      await expect(
        service.createUser({ ...createDto, personId: 'person-uuid' }, UserRole.ADMIN),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates user with hashed password, role and isActive=true', async () => {
      mockUserRepo.findOne.mockResolvedValueOnce(null); // email check

      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(makeUser({ role: UserRole.TECHNICAL, isActive: true })); // user save
      manager.findOne.mockResolvedValueOnce(makeUser({ role: UserRole.TECHNICAL, isActive: true })); // reload
      mockDataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      const result = await service.createUser(createDto, UserRole.ADMIN);

      expect(manager.create).toHaveBeenCalledWith(
        User,
        expect.objectContaining({
          email: 'tech@example.com',
          passwordHash: 'hashed-password',
          role: UserRole.TECHNICAL,
          isActive: true,
        }),
      );
      expect(result.role).toBe(UserRole.TECHNICAL);
      expect(result.isActive).toBe(true);
    });

    it('throws ForbiddenException when TECHNICAL actor creates ADMIN user', async () => {
      await expect(
        service.createUser(
          { ...createDto, role: UserRole.ADMIN },
          UserRole.TECHNICAL,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('links person when personId is provided, atomically with the user save', async () => {
      const person = makePerson({ managedBy: null });
      mockUserRepo.findOne.mockResolvedValueOnce(null); // email check
      mockPersonRepo.findOne.mockResolvedValue(person);

      const manager = makeTransactionManager();
      manager.save.mockResolvedValueOnce(makeUser({ person })); // user save
      manager.findOne.mockResolvedValueOnce(makeUser({ person })); // reload
      mockDataSource.transaction.mockImplementation((cb: (m: unknown) => unknown) => cb(manager));

      await service.createUser({ ...createDto, personId: 'person-uuid' }, UserRole.ADMIN);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(manager.save).toHaveBeenCalledWith(
        Person,
        expect.objectContaining({ managedBy: expect.any(Object) }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // updateUser
  // ---------------------------------------------------------------------------

  describe('updateUser', () => {
    it('throws NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        service.updateUser('missing-id', { email: 'new@mail.com' }, UserRole.ADMIN, 'actor-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when new email already taken', async () => {
      const user = makeUser();
      mockUserRepo.findOne
        .mockResolvedValueOnce(user) // load user
        .mockResolvedValueOnce(makeUser({ id: 'other-user' })); // email check
      await expect(
        service.updateUser('user-uuid', { email: 'taken@mail.com' }, UserRole.ADMIN, 'actor-uuid'),
      ).rejects.toThrow(ConflictException);
    });

    it('updates email when not conflicting', async () => {
      const user = makeUser();
      mockUserRepo.findOne
        .mockResolvedValueOnce(user) // load user
        .mockResolvedValueOnce(null) // email check (no conflict)
        .mockResolvedValueOnce({ ...user, email: 'new@mail.com' }); // reload
      mockUserRepo.save.mockResolvedValue({ ...user, email: 'new@mail.com' });

      const result = await service.updateUser('user-uuid', {
        email: 'new@mail.com',
      }, UserRole.ADMIN, 'actor-uuid');
      expect(result.email).toBe('new@mail.com');
    });

    it('updates role when actor is ADMIN', async () => {
      const user = makeUser({ role: UserRole.TECHNICAL });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, role: UserRole.ADMIN });
      mockUserRepo.save.mockResolvedValue({ ...user, role: UserRole.ADMIN });

      const result = await service.updateUser('user-uuid', {
        role: UserRole.ADMIN,
      }, UserRole.ADMIN, 'actor-uuid');
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('throws ForbiddenException when TECHNICAL actor promotes user to ADMIN', async () => {
      const user = makeUser({ role: UserRole.TECHNICAL });
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateUser(
          'user-uuid',
          { role: UserRole.ADMIN },
          UserRole.TECHNICAL,
          'actor-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN actor to demote ADMIN user to TECHNICAL', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, role: UserRole.TECHNICAL });
      mockUserRepo.save.mockResolvedValue({ ...user, role: UserRole.TECHNICAL });

      const result = await service.updateUser(
        'user-uuid',
        { role: UserRole.TECHNICAL },
        UserRole.ADMIN,
        'actor-uuid',
      );
      expect(result.role).toBe(UserRole.TECHNICAL);
    });

    it('updates isActive', async () => {
      const user = makeUser({ isActive: true });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, isActive: false });
      mockUserRepo.save.mockResolvedValue({ ...user, isActive: false });

      const result = await service.updateUser('user-uuid', { isActive: false }, UserRole.ADMIN, 'actor-uuid');
      expect(result.isActive).toBe(false);
    });

    it('unlinks person when personId is null', async () => {
      const person = makePerson();
      const user = makeUser({ person: person as unknown as Person });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce({ ...user, person: null });
      mockPersonRepo.findOne.mockResolvedValue(person);
      mockPersonRepo.save.mockResolvedValue(person);
      mockUserRepo.save.mockResolvedValue({ ...user, person: null });

      const result = await service.updateUser('user-uuid', {
        personId: null,
      }, UserRole.ADMIN, 'actor-uuid');
      expect(result.person).toBeNull();
    });

    it('throws BadRequestException when linking person already managed by another', async () => {
      const user = makeUser({ person: null });
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      mockPersonRepo.findOne.mockResolvedValue(
        makePerson({ managedBy: makeUser({ id: 'other-user' }) }),
      );
      await expect(
        service.updateUser('user-uuid', { personId: 'person-uuid' }, UserRole.ADMIN, 'actor-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ForbiddenException when TECHNICAL actor edits an ADMIN account email', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateUser(
          'user-uuid',
          { email: 'new@mail.com' },
          UserRole.TECHNICAL,
          'actor-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when TECHNICAL actor deactivates an ADMIN account via updateUser', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateUser('user-uuid', { isActive: false }, UserRole.TECHNICAL, 'actor-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN actor to edit another ADMIN account', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...user, email: 'new@mail.com' });
      mockUserRepo.save.mockResolvedValue({ ...user, email: 'new@mail.com' });

      const result = await service.updateUser(
        'user-uuid',
        { email: 'new@mail.com' },
        UserRole.ADMIN,
        'actor-uuid',
      );
      expect(result.email).toBe('new@mail.com');
    });

    it('throws ForbiddenException when an ADMIN actor tries to deactivate their own account', async () => {
      const user = makeUser({ role: UserRole.ADMIN, isActive: true });
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateUser(
          'user-uuid',
          { isActive: false },
          UserRole.ADMIN,
          'user-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException when an ADMIN actor tries to change their own role', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne.mockResolvedValueOnce(user);

      await expect(
        service.updateUser(
          'user-uuid',
          { role: UserRole.TECHNICAL },
          UserRole.ADMIN,
          'user-uuid',
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows an actor to update their own account when isActive is not touched', async () => {
      const user = makeUser({ role: UserRole.ADMIN });
      mockUserRepo.findOne
        .mockResolvedValueOnce(user)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...user, email: 'new@mail.com' });
      mockUserRepo.save.mockResolvedValue({ ...user, email: 'new@mail.com' });

      const result = await service.updateUser(
        'user-uuid',
        { email: 'new@mail.com' },
        UserRole.ADMIN,
        'user-uuid',
      );
      expect(result.email).toBe('new@mail.com');
    });

    it('does not re-fetch the user after saving when email is unchanged', async () => {
      const user = makeUser({ isActive: true });
      mockUserRepo.findOne.mockResolvedValueOnce(user);
      mockUserRepo.save.mockResolvedValue({ ...user, isActive: false });

      const result = await service.updateUser(
        'user-uuid',
        { isActive: false },
        UserRole.ADMIN,
        'actor-uuid',
      );

      expect(mockUserRepo.findOne).toHaveBeenCalledTimes(1);
      expect(result.isActive).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // deactivateUser
  // ---------------------------------------------------------------------------

  describe('deactivateUser', () => {
    it('throws NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(
        service.deactivateUser('missing-id', UserRole.ADMIN, 'actor-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('sets isActive to false and saves', async () => {
      const user = makeUser({ isActive: true });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, isActive: false });

      await service.deactivateUser('user-uuid', UserRole.ADMIN, 'actor-uuid');

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws ForbiddenException when TECHNICAL actor deactivates an ADMIN account', async () => {
      const user = makeUser({ role: UserRole.ADMIN, isActive: true });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(
        service.deactivateUser('user-uuid', UserRole.TECHNICAL, 'actor-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows ADMIN actor to deactivate an ADMIN account', async () => {
      const user = makeUser({ role: UserRole.ADMIN, isActive: true });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, isActive: false });

      await service.deactivateUser('user-uuid', UserRole.ADMIN, 'actor-uuid');

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
    });

    it('throws ForbiddenException when a user tries to deactivate their own account', async () => {
      const user = makeUser({ role: UserRole.ADMIN, isActive: true });
      mockUserRepo.findOne.mockResolvedValue(user);

      await expect(
        service.deactivateUser('user-uuid', UserRole.ADMIN, 'user-uuid'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
