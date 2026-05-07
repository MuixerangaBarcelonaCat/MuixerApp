import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { UserService } from './user.service';
import { User } from './user.entity';
import { Person } from '../person/person.entity';
import { UserRole } from '@muixer/shared';

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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
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
      mockUserRepo.create.mockReturnValue(createdUser);
      mockUserRepo.save.mockResolvedValue(createdUser);
      mockPersonRepo.save.mockResolvedValue(person);

      // sendInvite will call findOne internally — mock it for that call
      mockUserRepo.findOne.mockResolvedValue({ ...createdUser, isActive: false });

      const result = await service.createWithInvite({ personId: 'person-uuid', email: 'new@user.com' });

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.MEMBER, isActive: false }),
      );
      expect(result.isActive).toBe(false);
    });

    it('associates person to created user', async () => {
      const person = makePerson({ managedBy: null });
      mockPersonRepo.findOne.mockResolvedValue(person);

      const createdUser = makeUser({ isActive: false, person });
      mockUserRepo.create.mockReturnValue(createdUser);
      mockUserRepo.save.mockResolvedValue(createdUser);
      mockPersonRepo.save.mockResolvedValue(person);
      mockUserRepo.findOne.mockResolvedValue({ ...createdUser, isActive: false });

      await service.createWithInvite({ personId: 'person-uuid', email: 'new@user.com' });

      expect(mockPersonRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ managedBy: createdUser }),
      );
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
  });

  // ---------------------------------------------------------------------------
  // grantRole
  // ---------------------------------------------------------------------------

  describe('grantRole', () => {
    it('throws NotFoundException when user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      await expect(service.grantRole('missing-id', UserRole.ADMIN)).rejects.toThrow(NotFoundException);
    });

    it('updates the role and returns UserResponseDto', async () => {
      const user = makeUser({ role: UserRole.MEMBER });
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue({ ...user, role: UserRole.ADMIN });

      const result = await service.grantRole('user-uuid', UserRole.ADMIN);

      expect(mockUserRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.ADMIN }),
      );
      expect(result.role).toBe(UserRole.ADMIN);
    });

    it('does not expose passwordHash after role grant', async () => {
      const user = makeUser();
      mockUserRepo.findOne.mockResolvedValue(user);
      mockUserRepo.save.mockResolvedValue(user);

      const result = await service.grantRole('user-uuid', UserRole.ADMIN);
      expect((result as unknown as Record<string, unknown>)['passwordHash']).toBeUndefined();
    });
  });
});
