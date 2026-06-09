import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CompositionTemplateService } from './composition-template.service';
import { CompositionTemplate } from './entities/composition-template.entity';
import { CompositionSlot } from './entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

const makeFigureTemplate = (overrides: Partial<FigureTemplate> = {}): FigureTemplate =>
  ({
    id: 'fig-uuid',
    name: 'Pinet Doble de 4',
    slug: 'pd4',
    description: null,
    hasPinya: true,
    direction: 0,
    metadata: {},
    nodes: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as FigureTemplate;

const makeFigureNode = () => ({
  id: 'node-uuid',
  label: 'Base 1',
  zone: FigureZone.BASE,
  positionType: 'base',
  x: 500,
  y: 500,
  z: 0,
  width: 60,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.ELLIPSE,
  sortOrder: 0,
  climbPath: null,
  metadata: {},
  template: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeSlot = (overrides: Partial<CompositionSlot> = {}): CompositionSlot =>
  ({
    id: 'slot-uuid',
    label: null,
    offsetX: 0,
    offsetY: 0,
    sortOrder: 0,
    figureTemplate: makeFigureTemplate(),
    composition: null,
    ...overrides,
  }) as CompositionSlot;

const makeComposition = (
  overrides: Partial<CompositionTemplate> = {},
): CompositionTemplate =>
  ({
    id: 'comp-uuid',
    name: 'Altar',
    slug: 'altar',
    description: null,
    slots: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as CompositionTemplate;

describe('CompositionTemplateService', () => {
  let service: CompositionTemplateService;
  let compositionQb: Record<string, jest.Mock>;

  const mockFigureTemplateRepo = {
    findOne: jest.fn(),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockFigureInstanceRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  const mockSlotRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const mockCompositionRepo = {
    createQueryBuilder: jest.fn(() => compositionQb),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...makeComposition(), ...dto })),
    save: jest.fn(),
    remove: jest.fn(),
  };

  // C2: transaction manager mock for syncSlots
  const mockTxManager = {
    delete: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((_entity: any, dto: any) => dto),
    save: jest.fn().mockResolvedValue([]),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb: any) => cb(mockTxManager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    compositionQb = {
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockTxManager.delete.mockResolvedValue(undefined);
    mockTxManager.create.mockImplementation((_entity: any, dto: any) => dto);
    mockTxManager.save.mockResolvedValue([]);
    mockDataSource.transaction.mockImplementation((cb: any) => cb(mockTxManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompositionTemplateService,
        {
          provide: getRepositoryToken(CompositionTemplate),
          useValue: mockCompositionRepo,
        },
        {
          provide: getRepositoryToken(CompositionSlot),
          useValue: mockSlotRepo,
        },
        {
          provide: getRepositoryToken(FigureTemplate),
          useValue: mockFigureTemplateRepo,
        },
        {
          provide: getRepositoryToken(FigureInstance),
          useValue: mockFigureInstanceRepo,
        },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CompositionTemplateService>(CompositionTemplateService);
  });

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies search filter with ILIKE and unaccent', async () => {
      await service.findAll({ search: 'altar' });
      expect(compositionQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%altar%' }),
      );
    });

    it('uses pagination values for skip and take', async () => {
      compositionQb.getMany.mockResolvedValue([makeComposition()]);
      compositionQb.getCount.mockResolvedValue(1);
      await service.findAll({ page: 3, limit: 10 });
      expect(compositionQb.skip).toHaveBeenCalledWith(20);
      expect(compositionQb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('returns detail with slots and populated figureTemplate + nodes', async () => {
      const figTemplate = makeFigureTemplate({ nodes: [makeFigureNode() as never] });
      const slot = makeSlot({ figureTemplate: figTemplate });
      const comp = makeComposition({ slots: [slot] });
      mockCompositionRepo.findOne.mockResolvedValue(comp);

      const result = await service.findOne('comp-uuid');

      expect(result.id).toBe('comp-uuid');
      expect(result.slots).toHaveLength(1);
      expect(result.slots[0].figureTemplate.id).toBe('fig-uuid');
      expect(result.slots[0].figureTemplate.nodes).toHaveLength(1);
    });

    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates composition without slots and returns detail', async () => {
      const saved = makeComposition({ id: 'new-uuid' });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(null)              // assertSlugAvailable: slug free
        .mockResolvedValueOnce({ ...saved, slots: [] }); // findOne at end
      mockCompositionRepo.save.mockResolvedValue(saved);

      const result = await service.create({ name: 'Altar', slug: 'altar', slots: [] });

      expect(result.id).toBe('new-uuid');
      expect(mockCompositionRepo.save).toHaveBeenCalled();
    });

    it('creates composition with slots and saves each slot', async () => {
      const figTemplate = makeFigureTemplate();
      const saved = makeComposition({ id: 'new-uuid' });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(null)              // assertSlugAvailable
        .mockResolvedValueOnce({ ...saved, slots: [makeSlot()] }); // findOne at end
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockFigureTemplateRepo.findOne.mockResolvedValue(figTemplate);
      mockSlotRepo.save.mockResolvedValue([makeSlot()]);

      await service.create({
        name: 'Altar',
        slug: 'altar',
        slots: [{ figureTemplateId: 'fig-uuid', offsetX: 0, offsetY: 0 }],
      });

      expect(mockFigureTemplateRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'fig-uuid' },
      });
      expect(mockSlotRepo.save).toHaveBeenCalled();
    });

    // H5 — slug uniqueness on create
    it('throws ConflictException when creating with an already-used slug', async () => {
      const other = makeComposition({ id: 'other-uuid', slug: 'altar' });
      // Use mockResolvedValueOnce so the default value doesn't bleed into subsequent tests
      mockCompositionRepo.findOne.mockResolvedValueOnce(other); // assertSlugAvailable: slug taken

      await expect(
        service.create({ name: 'Nova Altar', slug: 'altar', slots: [] }),
      ).rejects.toThrow(ConflictException);

      expect(mockCompositionRepo.save).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for invalid figureTemplateId in createSlots', async () => {
      const saved = makeComposition({ id: 'new-uuid' });
      // assertSlugAvailable: findOne returns null (slug free), no extra values needed
      // createSlots calls figureTemplateRepo.findOne (not compositionRepo.findOne)
      mockCompositionRepo.findOne.mockResolvedValueOnce(null);
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockFigureTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Altar',
          slug: 'altar',
          slots: [{ figureTemplateId: 'nonexistent', offsetX: 0, offsetY: 0 }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('updates scalar fields', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)
        .mockResolvedValueOnce({ ...comp, name: 'Nou nom', slots: [] });
      mockCompositionRepo.save.mockResolvedValue({ ...comp, name: 'Nou nom' });

      const result = await service.update('comp-uuid', { name: 'Nou nom' });
      expect(result.name).toBe('Nou nom');
    });

    it('replaces slots when slots array is provided (C2: via transaction)', async () => {
      const comp = makeComposition({ slots: [makeSlot()] });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)
        .mockResolvedValueOnce({ ...comp, slots: [] });
      mockCompositionRepo.save.mockResolvedValue(comp);

      await service.update('comp-uuid', { slots: [] });

      // delete goes through the transaction manager, not slotRepo directly
      expect(mockTxManager.delete).toHaveBeenCalled();
    });

    it('pre-validates figureTemplateIds before deleting slots (C2: fail-safe)', async () => {
      const comp = makeComposition({ slots: [] });
      mockCompositionRepo.findOne.mockResolvedValue(comp);
      mockCompositionRepo.save.mockResolvedValue(comp);
      // One of the template IDs does not exist
      mockFigureTemplateRepo.find.mockResolvedValue([]); // none found

      await expect(
        service.update('comp-uuid', {
          slots: [{ figureTemplateId: 'nonexistent', offsetX: 0, offsetY: 0 }],
        }),
      ).rejects.toThrow(NotFoundException);

      // Transaction must NOT have been called — delete was never reached
      expect(mockTxManager.delete).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });

    // H5 — slug uniqueness
    it('throws ConflictException when updating to a slug already used by another composition', async () => {
      const comp = makeComposition({ id: 'comp-uuid', slug: 'altar' });
      const other = makeComposition({ id: 'other-uuid', slug: 'existing-slug' });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)       // update: find composition
        .mockResolvedValueOnce(other);     // assertSlugAvailable: slug taken

      await expect(
        service.update('comp-uuid', { slug: 'existing-slug' }),
      ).rejects.toThrow(ConflictException);
    });

    it('allows updating slug to the same value (no conflict with self)', async () => {
      const comp = makeComposition({ id: 'comp-uuid', slug: 'altar' });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)     // update: find composition
        .mockResolvedValueOnce(comp)     // assertSlugAvailable: same composition found (excludeId matches)
        .mockResolvedValueOnce({ ...comp, slots: [] }); // findOne at end
      mockCompositionRepo.save.mockResolvedValue(comp);

      await expect(
        service.update('comp-uuid', { slug: 'altar' }),
      ).resolves.not.toThrow();
    });
  });

  describe('remove', () => {
    it('removes composition', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne.mockResolvedValue(comp);
      mockFigureInstanceRepo.count.mockResolvedValue(0);
      mockCompositionRepo.remove.mockResolvedValue(comp);

      await service.remove('comp-uuid');
      expect(mockCompositionRepo.remove).toHaveBeenCalledWith(comp);
    });

    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when composition is used in figure instances', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne.mockResolvedValue(comp);
      mockFigureInstanceRepo.count.mockResolvedValue(2);

      await expect(service.remove('comp-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('duplicate', () => {
    it('creates a copy with "(còpia)" suffix and same slot references', async () => {
      const figTemplate = makeFigureTemplate();
      const original = makeComposition({ slots: [makeSlot({ figureTemplate: figTemplate })] });
      mockCompositionRepo.findOne.mockResolvedValueOnce(original);

      const copyComp = makeComposition({ id: 'copy-uuid', name: 'Altar (còpia)' });
      mockCompositionRepo.save.mockResolvedValue(copyComp);
      mockFigureTemplateRepo.findOne.mockResolvedValue(figTemplate);
      mockSlotRepo.save.mockResolvedValue([]);
      mockCompositionRepo.findOne.mockResolvedValueOnce({ ...copyComp, slots: [] });

      const result = await service.duplicate('comp-uuid');

      expect(mockCompositionRepo.save).toHaveBeenCalled();
      const savedArg = mockCompositionRepo.save.mock.calls[0][0];
      expect(savedArg.name).toContain('(còpia)');
      expect(result.id).toBe('copy-uuid');
    });

    it('throws NotFoundException when original not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
