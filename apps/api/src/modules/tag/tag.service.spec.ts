import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { Tag } from './tag.entity';
import { Person } from '../person/person.entity';
import { TagService } from './tag.service';
import { CreateTagDto } from './dto/create-tag.dto';
import { TagCategory } from '@muixer/shared';

const TAG_ID = 'tag-uuid-1';

const makeTag = (overrides: Partial<Tag> = {}): Partial<Tag> => ({
  id: TAG_ID,
  name: 'Vents',
  slug: 'vents',
  shortDescription: null,
  longDescription: null,
  color: '#ff0000',
  positionTypes: [],
  category: TagCategory.ALTRES,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const mockQb = {
  leftJoin: jest.fn().mockReturnThis(),
  addSelect: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
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

const mockPersonRepo = {
  findBy: jest.fn(),
};

describe('CreateTagDto validation', () => {
  it('rejects a payload missing category', async () => {
    const dto = plainToInstance(CreateTagDto, { name: 'Vents', slug: 'vents' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'category')).toBe(true);
  });

  it('accepts a payload with a valid category', async () => {
    const dto = plainToInstance(CreateTagDto, {
      name: 'Vents',
      slug: 'vents',
      category: TagCategory.PINYA,
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'category')).toBe(false);
  });
});

describe('TagService', () => {
  let service: TagService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPersonRepo.findBy.mockReset();
    mockRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.leftJoin.mockReturnThis();
    mockQb.addSelect.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.groupBy.mockReturnThis();
    mockQb.orderBy.mockReturnThis();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TagService,
        { provide: getRepositoryToken(Tag), useValue: mockRepo },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
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

    it('filters by category when provided', async () => {
      mockQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

      await service.findAll({ category: [TagCategory.PINYA] });

      expect(mockQb.andWhere).toHaveBeenCalledWith('tag.category IN (:...categories)', {
        categories: [TagCategory.PINYA],
      });
    });

    it('does not filter when no category is provided', async () => {
      mockQb.getRawAndEntities.mockResolvedValue({ entities: [], raw: [] });

      await service.findAll();

      expect(mockQb.andWhere).not.toHaveBeenCalled();
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
      const dto = { name: 'Vents', slug: 'vents', category: TagCategory.PINYA };
      mockRepo.save.mockResolvedValue(makeTag());

      const result = await service.create(dto);

      expect(result.name).toBe('Vents');
      expect(mockRepo.create).toHaveBeenCalledWith(dto);
    });

    it('propagates category to the persisted entity', async () => {
      const dto = { name: 'Vents', slug: 'vents', category: TagCategory.PINYA };
      mockRepo.save.mockImplementation(async (entity: Partial<Tag>) => entity as Tag);

      const result = await service.create(dto);

      expect(result.category).toBe(TagCategory.PINYA);
    });

    it('throws ConflictException on duplicate slug', async () => {
      const dto = { name: 'Vents', slug: 'vents', category: TagCategory.ALTRES };
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

    it('propagates category on update', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.save.mockResolvedValue(makeTag({ category: TagCategory.TRONC }));

      await service.update(TAG_ID, { category: TagCategory.TRONC });

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ id: TAG_ID, category: TagCategory.TRONC }),
      );
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

  describe('assignPersons', () => {
    const personIds = ['person-1', 'person-2'];

    it('adds a row per person via ON CONFLICT DO NOTHING inserts', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockPersonRepo.findBy.mockResolvedValue(personIds.map((id) => ({ id })));
      mockRepo.query.mockResolvedValue(undefined);

      await service.assignPersons(TAG_ID, personIds);

      expect(mockRepo.query).toHaveBeenCalledTimes(2);
      expect(mockRepo.query).toHaveBeenCalledWith(expect.stringContaining('ON CONFLICT DO NOTHING'), [
        'person-1',
        TAG_ID,
      ]);
    });

    it('re-assigning the same persons does not duplicate (idempotent insert)', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockPersonRepo.findBy.mockResolvedValue(personIds.map((id) => ({ id })));
      mockRepo.query.mockResolvedValue(undefined);

      await service.assignPersons(TAG_ID, personIds);
      await service.assignPersons(TAG_ID, personIds);

      expect(mockRepo.query).toHaveBeenCalledTimes(4);
    });

    it('throws NotFoundException when tag does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.assignPersons('bad-id', personIds)).rejects.toThrow(NotFoundException);
      expect(mockPersonRepo.findBy).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when a personId does not exist (checked after the tag)', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockPersonRepo.findBy.mockResolvedValue([{ id: 'person-1' }]);

      await expect(service.assignPersons(TAG_ID, personIds)).rejects.toThrow(NotFoundException);
      expect(mockRepo.query).not.toHaveBeenCalled();
    });
  });

  describe('unassignPerson', () => {
    it('deletes the relation row', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.query.mockResolvedValue(undefined);

      await service.unassignPerson(TAG_ID, 'person-1');

      expect(mockRepo.query).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM person_positions'), [
        'person-1',
        TAG_ID,
      ]);
    });

    it('is idempotent: removing an unlinked relation succeeds (no 404 on the missing relation)', async () => {
      mockRepo.findOne.mockResolvedValue(makeTag());
      mockRepo.query.mockResolvedValue(undefined);

      await expect(service.unassignPerson(TAG_ID, 'never-linked')).resolves.toBeUndefined();
    });

    it('throws NotFoundException when tag does not exist', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await expect(service.unassignPerson('bad-id', 'person-1')).rejects.toThrow(NotFoundException);
      expect(mockRepo.query).not.toHaveBeenCalled();
    });
  });
});
