import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Position } from '../position/position.entity';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';

describe('PersonService', () => {
  let service: PersonService;
  let personRepository: Repository<Person>;
  let positionRepository: Repository<Position>;

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
    findByIds: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonService,
        {
          provide: getRepositoryToken(Person),
          useValue: mockPersonRepository,
        },
        {
          provide: getRepositoryToken(Position),
          useValue: mockPositionRepository,
        },
      ],
    }).compile();

    service = module.get<PersonService>(PersonService);
    personRepository = module.get<Repository<Person>>(
      getRepositoryToken(Person),
    );
    positionRepository = module.get<Repository<Position>>(
      getRepositoryToken(Position),
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
      const mockPerson = { id: '123', name: 'Test', alias: 'test' };
      mockPersonRepository.findOne.mockResolvedValue(mockPerson);

      const result = await service.findOne('123');

      expect(result).toEqual(mockPerson);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor', 'managedBy'],
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

      mockPositionRepository.findByIds.mockResolvedValue(mockPositions);
      mockPersonRepository.create.mockReturnValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(mockPerson);

      const result = await service.create(createDto);

      expect(result.id).toBe('123');
      expect(result.name).toBe('Test');
      expect(result.alias).toBe('testuser');
      expect(mockPositionRepository.findByIds).toHaveBeenCalledWith([
        'pos1',
        'pos2',
      ]);
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

  describe('deactivate', () => {
    it('should deactivate a person and update lastSyncedAt', async () => {
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: true,
        lastSyncedAt: null,
      };
      const deactivatedPerson = {
        ...mockPerson,
        isActive: false,
        lastSyncedAt: expect.any(Date),
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(deactivatedPerson);

      const result = await service.deactivate('123');

      expect(result.isActive).toBe(false);
      expect(mockPersonRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
        relations: ['positions', 'mentor'],
      });
      expect(mockPersonRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '123',
          isActive: false,
          lastSyncedAt: expect.any(Date),
        }),
      );
    });

    it('should throw NotFoundException when person not found', async () => {
      mockPersonRepository.findOne.mockResolvedValue(null);

      await expect(service.deactivate('999')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('activate', () => {
    it('should activate a person and update lastSyncedAt', async () => {
      const mockPerson = {
        id: '123',
        name: 'Test',
        alias: 'test',
        isActive: false,
        lastSyncedAt: new Date('2024-01-01'),
      };
      const activatedPerson = {
        ...mockPerson,
        isActive: true,
        lastSyncedAt: expect.any(Date),
      };

      mockPersonRepository.findOne.mockResolvedValue(mockPerson);
      mockPersonRepository.save.mockResolvedValue(activatedPerson);

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
          lastSyncedAt: expect.any(Date),
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
});
