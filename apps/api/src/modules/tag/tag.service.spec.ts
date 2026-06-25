import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Tag } from './tag.entity';
import { TagService } from './tag.service';
import { FigureZone } from '@muixer/shared';

const TAG_ID = 'tag-uuid-1';

const makeTag = (overrides: Partial<Tag> = {}): Partial<Tag> => ({
  id: TAG_ID,
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
  create: jest.fn((data: Record<string, unknown>) => ({ ...data, id: TAG_ID })),
  save: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  query: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

describe('TagService', () => {
  let service: TagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.leftJoin.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.orderBy.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        { provide: getRepositoryToken(Tag), useValue: mockRepo },
      ],
    }).compile();

    service = module.get<TagService>(TagService);
  });

  describe('findAll', () => {
    it('returns tags with personCount via QueryBuilder', async () => {
      const tag = makeTag();
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [tag],
        raw: [{ personCount: 5 }],
      });

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Vents');
      expect(result[0].personCount).toBe(5);
      expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('tag');
    });

    it('defaults personCount to 0 when raw is null', async () => {
      const tag = makeTag();
      mockQb.getRawAndEntities.mockResolvedValue({
        entities: [tag],
        raw: [{}],
      });

      const result = await service.findAll();
      expect(result[0].personCount).toBe(0);
    });
  });

  describe('findOne', () => {
    it('returns tag by ID', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      const result = await service.findOne(TAG_ID);
      expect(result.id).toBe(TAG_ID);
    });

    it('throws NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates tag successfully', async () => {
      const dto = { name: 'Vents', slug: 'vents' };
      mockRepo.save.mockResolvedValue(makeTag());

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
    it('updates tag and returns refreshed entity', async () => {
      const updated = makeTag({ name: 'Mans' });
      mockRepo.findOne.mockResolvedValue(updated);
      mockRepo.save.mockResolvedValue(updated);

      const result = await service.update(TAG_ID, { name: 'Mans' });

      expect(result.name).toBe('Mans');
    });

    it('throws ConflictException on duplicate slug during update', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.save.mockRejectedValue({ code: '23505' });

      await expect(service.update(TAG_ID, { name: 'Dup' })).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('deletes tag when no persons assigned', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.query.mockResolvedValue([{ count: 0 }]);
      mockRepo.delete.mockResolvedValue({});

      await service.remove(TAG_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(TAG_ID);
    });

    it('throws ConflictException when persons are assigned', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.query.mockResolvedValue([{ count: 3 }]);

      await expect(service.remove(TAG_ID)).rejects.toThrow(ConflictException);
      expect(mockRepo.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if tag not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-id')).rejects.toThrow(NotFoundException);
    });
  });
});
