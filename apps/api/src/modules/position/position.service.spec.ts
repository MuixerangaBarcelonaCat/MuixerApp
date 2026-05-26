import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Position } from './position.entity';
import { PositionService } from './position.service';
import { FigureZone } from '@muixer/shared';

const POS_ID = 'pos-uuid-1';

const makePosition = (overrides: Partial<Position> = {}): Partial<Position> => ({
  id: POS_ID,
  name: 'Vents',
  slug: 'vents',
  shortDescription: null,
  longDescription: null,
  color: '#ff0000',
  zone: FigureZone.PINYA,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockQb = {
  leftJoin: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  groupBy: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  getRawAndEntities: jest.fn(),
};

const mockRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn((data: Record<string, unknown>) => ({ ...data, id: POS_ID })),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

describe('PositionService', () => {
  let service: PositionService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.leftJoin.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.orderBy.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PositionService,
        { provide: getRepositoryToken(Position), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<PositionService>(PositionService);
  });

  describe('findAll', () => {
    it('returns positions with personCount via QueryBuilder', async () => {
      const pos = makePosition();
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [pos],
        raw: [{ personCount: 5 }],
      });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Vents');
      expect(result[0].personCount).toBe(5);
      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('position');
    });

    it('defaults personCount to 0 when raw is null', async () => {
      const pos = makePosition();
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [pos],
        raw: [{}],
      });

      const result = await service.findAll();
      expect(result[0].personCount).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns position by ID', async () => {
      mockRepo.findOne.mockResolvedValue(makePosition());
      const result = await service.findOne(POS_ID);
      expect(result.id).toBe(POS_ID);
    });

    it('throws NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates position successfully', async () => {
      const dto = { name: 'Vents', slug: 'vents' };
      mockRepo.save.mockResolvedValue(makePosition());

      const result = await service.create(dto);

      expect(result.name).toBe('Vents');
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
    });

    it('throws ConflictException on duplicate slug', async () => {
      const dto = { name: 'Vents', slug: 'vents' };
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates position and returns refreshed entity', async () => {
      const updated = makePosition({ name: 'Mans' });
      mockRepo.findOne.mockResolvedValue(updated);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(POS_ID, { name: 'Mans' });

      expect(result.name).toBe('Mans');
    });

    it('throws ConflictException on duplicate slug during update', async () => {
      mockRepo.findOne.mockResolvedValue(makePosition());
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.update(POS_ID, { name: 'Dup' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes position when no persons assigned', async () => {
      mockRepo.findOne.mockResolvedValue(makePosition());
      mockRepo.query.mockResolvedValue([{ count: 0 }]);
      mockRepo.delete.mockResolvedValue({});

      await service.remove(POS_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(POS_ID);
    });

    it('throws ConflictException when persons are assigned', async () => {
      mockRepo.findOne.mockResolvedValue(makePosition());
      mockRepo.query.mockResolvedValue([{ count: 3 }]);

      await expect(service.remove(POS_ID)).rejects.toThrow(ConflictException);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if position not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
