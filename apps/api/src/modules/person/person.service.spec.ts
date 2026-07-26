import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Tag } from '../tag/tag.entity';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { User } from '../user/user.entity';

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: Repository<Person>;
  let positionRepository: Repository<Tag>;

  const mockQueryBuilder = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getCount: jest.fn(),
    getMany: jest.fn(),
    getManyAndCount: jest.fn(),
  };

  const mockPersonRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(() => mockQueryBuilder),
  };

  const mockPositionRepository = {
    findBy: jest.fn(),
  };

  const mockUserRepository = {
    sendInvitation: jest.fn(),
    findOne: jest.fn(),
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepository,
        },
        {
          provide: getRepositoryToken(Tag),
          useValue: mockPositionRepository,
        },
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    personRepository = module.get<Repository<Person>>(
      getRepositoryToken(Person),
    );
    positionRepository = module.get<Repository<Tag>>(
      getRepositoryToken(Tag),
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a person when found', async () => {
      const mockPerson = { id: '123', name: 'Test', alias: 'test', managedBy: null };
      mockPersonRepository.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne('123');

      expect(result).toEqual(mockPerson);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor', 'managedBy', 'managedBy.person'],
      });
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a person without positions', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
      };
      const mockPerson = { id: '123', ...createDto };

      mockPersonRepository.create.mockReturnValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(mockPerson);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPerson);
      expect(mockPersonRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockPersonRepository.save).toHaveBeenCalledWith(mockPerson);
    });

    it('should create a person with positions', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
        positionIds: ['pos1', 'pos2'],
      };
      const mockPositions = [
        { id: 'pos1', name: 'Position 1' },
        { id: 'pos2', name: 'Position 2' },
      ];
      const mockPerson = { id: '123', ...createDto, positions: mockPositions };

      mockPositionRepository.findBy.mockResolvedValue(mockPositions);
      mockPersonRepository.create.mockReturnValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(mockPerson);

      const result = await service.create(createDto);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
      expect(result.alias).toBe('testuser');
      expect(mockPositionRepository.findBy).toHaveBeenCalledWith({
        id: In(['pos1', 'pos2']),
      });
    });

    it('throws NotFoundException when a position id does not exist', async () => {
      const createDto = {
        name: 'Test',
        firstSurname: 'User',
        alias: 'testuser',
        positionIds: ['pos1', 'typo-id'],
      };
      mockPositionRepository.findBy.mockResolvedValue([
        { id: 'pos1', name: 'Position 1' },
      ]);
      mockPersonRepository.create.mockReturnValue({ id: '123', ...createDto });

      await expect(service.create(createDto)).rejects.toThrow(NotFoundException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const mockPersons = [
        { id: '1', name: 'Person 1', alias: 'p1' },
        { id: '2', name: 'Person 2', alias: 'p2' },
      ];
      mockQueryBuilder.getCount.mockResolvedValue(2);
      mockQueryBuilder.getMany.mockResolvedValue(mockPersons);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result).toEqual({ data: mockPersons, total: 2 });
      expect(mockPersonRepository.createQueryBuilder).toHaveBeenCalledWith('person');
      expect(mockQueryBuilder.getCount).toHaveBeenCalled();
      expect(mockQueryBuilder.getMany).toHaveBeenCalled();
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('person.alias', 'ASC');
    });

    it('should order by name DESC when sort params provided', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'name', sortOrder: 'DESC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('person.name', 'DESC');
    });

    it('should order by shoulderHeight ASC', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, sortBy: 'shoulderHeight', sortOrder: 'ASC' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith(
        'person.shoulderHeight',
        'ASC',
      );
    });

    it('should apply isActive filter', async () => {
      mockQueryBuilder.getCount.mockResolvedValue(0);
      mockQueryBuilder.getMany.mockResolvedValue([]);

      await service.findAll({ page: 1, limit: 10, isActive: true });

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'person.isActive = :isActive',
        { isActive: true },
      );
    });
  });

  describe('softDelete', () => {
    it('should deactivate a person without touching lastSyncedAt (that field belongs to the legacy sync)', async () => {
      const originalLastSyncedAt = new Date('2024-01-01');
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: true,
        lastSyncedAt: originalLastSyncedAt,
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.softDelete('123');

      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          isActive: false,
          lastSyncedAt: originalLastSyncedAt,
        }),
      );
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.softDelete('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should activate a person without touching lastSyncedAt (that field belongs to the legacy sync)', async () => {
      const originalLastSyncedAt = new Date('2024-01-01');
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: false,
        lastSyncedAt: originalLastSyncedAt,
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      const result = await service.activate('123');

      expect(result.isActive).toBe(true);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor'],
      });
      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          isActive: true,
          lastSyncedAt: originalLastSyncedAt,
        }),
      );
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.activate('999')).rejects.toThrow(NotFoundException);
    });
  });

  // --- createProvisional ---
  describe('createProvisional', () => {
    it('creates a provisional person with ~ prefix', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);
      const savedPerson = { id: 'prov-1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, isActive: true, positions: [] };
      mockPersonRepository.create.mockReturnValue(savedPerson);
      mockPersonRepository.save.mockResolvedValue(savedPerson);

      await service.createProvisional('Joan');

      expect(mockPersonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ alias: '~Joan', isProvisional: true, isActive: true }),
      );
    });

    it('throws ConflictException if ~ alias already exists', async () => {
      const existing = { id: 'prov-1', alias: '~Joan' };
      mockPersonRepository.findOne.mockResolvedValue(existing);

      await expect(service.createProvisional('Joan')).rejects.toThrow(ConflictException);
    });

    it('truncates alias to 20 chars when prefixed', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);
      const alias = 'MoltLlargAliasXXXXXX'; // 20 chars → ~MoltLlargAliasXXXXX (20 chars)
      const expected = `~${alias}`.slice(0, 20);
      const savedPerson = { id: 'p', alias: expected, name: alias, firstSurname: '', isProvisional: true, isActive: true, positions: [] };
      mockPersonRepository.create.mockReturnValue(savedPerson);
      mockPersonRepository.save.mockResolvedValue(savedPerson);

      await service.createProvisional(alias);

      expect(mockPersonRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ alias: expected }),
      );
    });
  });

  // --- update provisional transitions ---
  describe('update provisional', () => {
    it('auto-prefixes ~ when demoting a regular person', async () => {
      const regularPerson = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(regularPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: true });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: '~Joan', isProvisional: true }),
      );
    });

    it('throws ConflictException (not a raw DB error) when demotion prefix collides with an existing alias', async () => {
      const regularPerson = { id: '1', alias: 'JoanExisting', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const otherPerson = { id: '2', alias: '~JoanExisting' };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(regularPerson)
        .mockResolvedValueOnce(otherPerson);

      await expect(service.update('1', { isProvisional: true })).rejects.toThrow(ConflictException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('throws ConflictException when a plain alias update collides with another person', async () => {
      const person = { id: '1', alias: 'OldAlias', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const otherPerson = { id: '2', alias: 'TakenAlias' };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce(otherPerson);

      await expect(service.update('1', { alias: 'TakenAlias' })).rejects.toThrow(ConflictException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('allows updating alias when the new alias is free', async () => {
      const person = { id: '1', alias: 'OldAlias', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne
        .mockResolvedValueOnce(person)
        .mockResolvedValueOnce(null);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { alias: 'FreeAlias' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ alias: 'FreeAlias' }),
      );
    });

    it('throws BadRequestException when promoting without name', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, positions: [], mentor: null, managedBy: {'id': 'user_id'} };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);

      await expect(service.update('1', { isProvisional: false, alias: 'JoanNou' }))
        .rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when promoting without user', async () => {
      const provisionalPerson = {
        id: '1',
        alias: '~Joan',
        name: 'Joan',
        firstSurname: '',
        isProvisional: true,
        positions: [],
        mentor: null,
      };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);

      await expect(
        service.update('1', { isProvisional: false, alias: 'JoanNou' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('loads the managedBy relation so the promotion check sees it', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, managedBy: { id: 'user_id' } };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia' });

      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        relations: ['positions', 'mentor', 'managedBy'],
      });
    });

    it('promotes when managedById is provided in the same request even if the person has no manager yet', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, managedBy: null };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockUserRepository.findOne.mockResolvedValue({ id: 'user_id' });
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia', managedById: 'user_id' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isProvisional: false, managedBy: { id: 'user_id' } }),
      );
    });

    it('throws BadRequestException when promoting with ~ alias', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: 'García', isProvisional: true, positions: [], mentor: null, managedBy: {'id': 'user_id'} };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);

      await expect(service.update('1', { isProvisional: false, name: 'Joan', firstSurname: 'García' }))
        .rejects.toThrow(BadRequestException);
    });

    it('promotes provisional person when all fields provided', async () => {
      const provisionalPerson = { id: '1', alias: '~Joan', name: 'Joan', firstSurname: '', isProvisional: true, positions: [], mentor: null, managedBy: {'id': 'user_id'} };
      mockPersonRepository.findOne.mockResolvedValue(provisionalPerson);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { isProvisional: false, alias: 'JoanGarcia', name: 'Joan', firstSurname: 'García' });

      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ isProvisional: false, alias: 'JoanGarcia', firstSurname: 'García' }),
      );
    });
  });

  describe('update positions', () => {
    it('throws NotFoundException when a position id does not exist', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPositionRepository.findBy.mockResolvedValue([{ id: 'pos1', name: 'Position 1' }]);

      await expect(
        service.update('1', { positionIds: ['pos1', 'typo-id'] }),
      ).rejects.toThrow(NotFoundException);
      expect(mockPersonRepository.save).not.toHaveBeenCalled();
    });

    it('uses findBy/In to resolve positions', async () => {
      const person = { id: '1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isProvisional: false, positions: [], mentor: null };
      const mockPositions = [{ id: 'pos1', name: 'Position 1' }];
      mockPersonRepository.findOne.mockResolvedValue(person);
      mockPositionRepository.findBy.mockResolvedValue(mockPositions);
      mockPersonRepository.save.mockImplementation((p: Person) => Promise.resolve(p));

      await service.update('1', { positionIds: ['pos1'] });

      expect(mockPositionRepository.findBy).toHaveBeenCalledWith({ id: In(['pos1']) });
    });
  });
});
