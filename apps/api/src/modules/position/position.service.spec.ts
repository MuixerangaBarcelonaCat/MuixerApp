import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PositionService } from './position.service';
import { Position } from './position.entity';
import { NotFoundException } from '@nestjs/common';

describe('PositionService', () => {
  let service: PositionService;
  let repository: Repository<Position>;

  const mockRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        {
          provide: getRepositoryToken(Position),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
    repository = module.get<Repository<Position>>(getRepositoryToken(Position));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findOne', () => {
    it('should return a position when found', async () => {
      const mockPosition = { id: '123', name: 'Baix', slug: 'baix' };
      mockRepository.findOne.mockResolvedValue(mockPosition);

      const result = await service.findOne('123');

      expect(result).toEqual(mockPosition);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw NotFoundException when position not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne('999')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('should create a position', async () => {
      const createDto = { name: 'Baix', slug: 'baix' };
      const mockPosition = { id: '123', ...createDto };

      mockRepository.create.mockReturnValue(mockPosition);
      mockRepository.save.mockResolvedValue(mockPosition);

      const result = await service.create(createDto);

      expect(result).toEqual(mockPosition);
      expect(mockRepository.create).toHaveBeenCalledWith(createDto);
      expect(mockRepository.save).toHaveBeenCalledWith(mockPosition);
    });
  });

  describe('findAll', () => {
    it('should return all positions', async () => {
      const mockPositions = [
        { id: '1', name: 'Baix', slug: 'baix' },
        { id: '2', name: 'Acotxador', slug: 'acotxador' },
      ];
      mockRepository.find.mockResolvedValue(mockPositions);

      const result = await service.findAll();

      expect(result).toEqual(mockPositions);
      expect(mockRepository.find).toHaveBeenCalled();
    });
  });
});
