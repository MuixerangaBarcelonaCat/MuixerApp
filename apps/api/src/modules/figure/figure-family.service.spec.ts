import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FigureFamilyService } from './figure-family.service';
import { FigureFamily } from './entities/figure-family.entity';

const makeFamily = (overrides: Partial<FigureFamily> = {}): FigureFamily => ({
  id: 'family-uuid',
  name: 'Pilar de 4',
  slug: 'pilar-de-4',
  description: null,
  metadata: {},
  templates: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureFamily);

describe('FigureFamilyService', () => {
  let service: FigureFamilyService;
  let familyQb: Record<string, jest.Mock>;

  const mockFamilyRepo = {
    createQueryBuilder: jest.fn(() => familyQb),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...makeFamily(), ...dto })),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    familyQb = {
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureFamilyService,
        { provide: getRepositoryToken(FigureFamily), useValue: mockFamilyRepo },
      ],
    }).compile();

    service = module.get<FigureFamilyService>(FigureFamilyService);
  });

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies search filter', async () => {
      await service.findAll({ search: 'pilar' });
      expect(familyQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%pilar%' }),
      );
    });

    it('paginates correctly', async () => {
      familyQb.getMany.mockResolvedValue([makeFamily()]);
      familyQb.getCount.mockResolvedValue(1);
      await service.findAll({ page: 2, limit: 10 });
      expect(familyQb.skip).toHaveBeenCalledWith(10);
      expect(familyQb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('returns family detail with variants ordered by variantOrder', async () => {
      const family = makeFamily({
        templates: [
          { id: 't2', name: 'V2', slug: 'v2', variantOrder: 2, nodes: [] } as any,
          { id: 't1', name: 'V1', slug: 'v1', variantOrder: 1, nodes: [] } as any,
        ],
      });
      mockFamilyRepo.findOne.mockResolvedValue(family);

      const result = await service.findOne('family-uuid');
      expect(result.variants[0].variantOrder).toBe(1);
      expect(result.variants[1].variantOrder).toBe(2);
    });

    it('throws NotFoundException when not found', async () => {
      mockFamilyRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a family and returns detail', async () => {
      const saved = makeFamily({ id: 'new-uuid' });
      mockFamilyRepo.findOne
        .mockResolvedValueOnce(null) // assertSlugAvailable: slug not taken
        .mockResolvedValueOnce({ ...saved, templates: [] }); // findOne after create
      mockFamilyRepo.save.mockResolvedValue(saved);

      const result = await service.create({ name: 'Pilar de 4', slug: 'pilar-de-4' });
      expect(result.id).toBe('new-uuid');
    });

    it('throws ConflictException when slug already taken', async () => {
      mockFamilyRepo.findOne.mockResolvedValue(makeFamily({ id: 'other-uuid' }));
      await expect(
        service.create({ name: 'Duplicate', slug: 'pilar-de-4' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('updates name and description', async () => {
      const family = makeFamily();
      mockFamilyRepo.findOne
        .mockResolvedValueOnce(family)
        .mockResolvedValueOnce({ ...family, name: 'Nou nom', templates: [] });
      mockFamilyRepo.save.mockResolvedValue({ ...family, name: 'Nou nom' });

      const result = await service.update('family-uuid', { name: 'Nou nom' });
      expect(result.name).toBe('Nou nom');
    });

    it('throws ConflictException when new slug is taken by another family', async () => {
      const family = makeFamily({ id: 'family-uuid' });
      const other = makeFamily({ id: 'other-uuid', slug: 'taken-slug' });
      mockFamilyRepo.findOne
        .mockResolvedValueOnce(family) // load for update
        .mockResolvedValueOnce(other); // assertSlugAvailable: already taken
      await expect(
        service.update('family-uuid', { slug: 'taken-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      mockFamilyRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes a family with no variants', async () => {
      const family = makeFamily({ templates: [] });
      mockFamilyRepo.findOne.mockResolvedValue(family);
      mockFamilyRepo.remove.mockResolvedValue(family);

      await service.remove('family-uuid');
      expect(mockFamilyRepo.remove).toHaveBeenCalledWith(family);
    });

    it('throws ConflictException when family has variants', async () => {
      const family = makeFamily({
        templates: [{ id: 't1' } as any],
      });
      mockFamilyRepo.findOne.mockResolvedValue(family);

      await expect(service.remove('family-uuid')).rejects.toThrow(ConflictException);
    });

    it('throws NotFoundException when not found', async () => {
      mockFamilyRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
