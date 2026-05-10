import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CompositionTemplateService } from './composition-template.service';
import { CompositionTemplate } from './entities/composition-template.entity';
import { CompositionSlot } from './entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
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
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockCompositionRepo.findOne.mockResolvedValue({ ...saved, slots: [] });

      const result = await service.create({ name: 'Altar', slug: 'altar', slots: [] });

      expect(result.id).toBe('new-uuid');
      expect(mockCompositionRepo.save).toHaveBeenCalled();
    });

    it('creates composition with slots and saves each slot', async () => {
      const saved = makeComposition({ id: 'new-uuid' });
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockCompositionRepo.findOne.mockResolvedValue({
        ...saved,
        slots: [makeSlot()],
      });
      mockFigureTemplateRepo.findOne.mockResolvedValue(makeFigureTemplate());
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

    it('throws NotFoundException for invalid figureTemplateId', async () => {
      const saved = makeComposition({ id: 'new-uuid' });
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

    it('replaces slots when slots array is provided', async () => {
      const comp = makeComposition({ slots: [makeSlot()] });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)
        .mockResolvedValueOnce({ ...comp, slots: [] });
      mockCompositionRepo.save.mockResolvedValue(comp);

      await service.update('comp-uuid', { slots: [] });

      expect(mockSlotRepo.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('removes composition', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne.mockResolvedValue(comp);
      mockCompositionRepo.remove.mockResolvedValue(comp);

      await service.remove('comp-uuid');
      expect(mockCompositionRepo.remove).toHaveBeenCalledWith(comp);
    });

    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
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
