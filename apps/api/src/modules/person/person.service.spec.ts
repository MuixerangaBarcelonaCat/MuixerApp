import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PersonService } from './person.service';
import { Person } from './person.entity';
import { Position } from '../position/position.entity';
import { NotFoundException } from '@nestjs/common';

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
});
