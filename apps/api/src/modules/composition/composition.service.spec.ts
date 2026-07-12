import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CompositionService } from './composition.service';
import { Composition } from './entities/composition.entity';
import { CompositionEntry } from './entities/composition-entry.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureMode, FigureZone } from '@muixer/shared';

const makeTemplate = (overrides: Partial<FigureTemplate> = {}): FigureTemplate => ({
  id: 'tmpl-1',
  name: 'Pilar de 4',
  slug: 'pd4',
  description: null,
  direction: 0,
  metadata: {},
  nodes: [],
  rengles: [],
  instances: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureTemplate);

const makeEntry = (overrides: Partial<CompositionEntry> = {}): CompositionEntry => ({
  id: 'entry-1',
  label: null,
  offsetX: 0,
  offsetY: 0,
  angle: 0,
  troncPanelX: null,
  troncPanelY: null,
  figureMode: FigureMode.COMPLETA,
  numberOfCordons: null,
  sortOrder: 0,
  composition: null as unknown as Composition,
  figureTemplate: makeTemplate(),
  ...overrides,
} as CompositionEntry);

const makeComposition = (overrides: Partial<Composition> = {}): Composition => ({
  id: 'comp-1',
  name: 'Composició Test',
  description: null,
  entries: [],
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  ...overrides,
} as Composition);

describe('CompositionService', () => {
  let service: CompositionService;

  const mockCompositionRepo = {
    createQueryBuilder: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockEntryRepo = {
    delete: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockTemplateRepo = {
    findOne: jest.fn(),
  };

  const compositionQb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getMany: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCompositionRepo.createQueryBuilder.mockReturnValue(compositionQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompositionService,
        { provide: getRepositoryToken(Composition), useValue: mockCompositionRepo },
        { provide: getRepositoryToken(CompositionEntry), useValue: mockEntryRepo },
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
      ],
    }).compile();

    service = module.get<CompositionService>(CompositionService);
  });

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('maps compositions to list items with entryCount', async () => {
      const comp = makeComposition({ entries: [makeEntry(), makeEntry()] });
      compositionQb.getMany.mockResolvedValue([comp]);
      compositionQb.getCount.mockResolvedValue(1);

      const result = await service.findAll({});

      expect(result.data[0].entryCount).toBe(2);
      expect(result.data[0].name).toBe('Composició Test');
    });

    it('applies search filter', async () => {
      await service.findAll({ search: 'altar' });
      expect(compositionQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        { search: '%altar%' },
      );
    });

    it('respects page and limit', async () => {
      await service.findAll({ page: 2, limit: 5 });
      expect(compositionQb.skip).toHaveBeenCalledWith(5);
      expect(compositionQb.take).toHaveBeenCalledWith(5);
    });
  });

  describe('findOne', () => {
    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });

    it('returns composition detail with entries and troncGrid dimensions', async () => {
      const troncNode = {
        id: 'n1',
        zone: FigureZone.TRONC,
        x: 0,
        y: 0,
        z: 0,
        width: 4,
        height: 2,
        rotation: 0,
        label: 'P1',
        positionType: null,
        color: null,
        shape: 'rectangle',
        sortOrder: 0,
        climbIndicator: null,
        ringLevel: null,
        originNodeId: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
      };
      const template = makeTemplate({ nodes: [troncNode] as never });
      const entry = makeEntry({ figureTemplate: template });
      const comp = makeComposition({ entries: [entry] });

      mockCompositionRepo.findOne.mockResolvedValue(comp);

      const result = await service.findOne('comp-1');

      expect(result.id).toBe('comp-1');
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0].troncGridCols).toBe(4); // x(0) + width(4)
      expect(result.entries[0].troncGridRows).toBe(1); // 1 distinct z-level, no direction nodes
    });

    it('includes figureTemplate nodes in entries', async () => {
      const template = makeTemplate({ nodes: [] });
      const entry = makeEntry({ figureTemplate: template });
      const comp = makeComposition({ entries: [entry] });

      mockCompositionRepo.findOne.mockResolvedValue(comp);

      const result = await service.findOne('comp-1');
      expect(result.entries[0].figureTemplate.nodes).toEqual([]);
    });
  });

  describe('create', () => {
    it('creates composition without entries', async () => {
      const saved = makeComposition();
      mockCompositionRepo.create.mockReturnValue(saved);
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockCompositionRepo.findOne.mockResolvedValue({ ...saved, entries: [] });

      const result = await service.create({ name: 'Composició Test' });

      expect(mockCompositionRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('Composició Test');
    });

    it('creates composition with entries, looking up figureTemplate by id', async () => {
      const saved = makeComposition();
      mockCompositionRepo.create.mockReturnValue(saved);
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockEntryRepo.create.mockImplementation((dto) => dto);
      mockEntryRepo.save.mockResolvedValue([]);
      mockCompositionRepo.findOne.mockResolvedValue({ ...saved, entries: [makeEntry()] });

      const result = await service.create({
        name: 'Composició Test',
        entries: [{ figureTemplateId: 'tmpl-1', offsetX: 100 }],
      });

      expect(mockTemplateRepo.findOne).toHaveBeenCalledWith({ where: { id: 'tmpl-1' } });
      expect(result.entries).toHaveLength(1);
    });

    it('throws NotFoundException when entry references unknown figureTemplate', async () => {
      const saved = makeComposition();
      mockCompositionRepo.create.mockReturnValue(saved);
      mockCompositionRepo.save.mockResolvedValue(saved);
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(
        service.create({
          name: 'Test',
          entries: [{ figureTemplateId: 'bad-id' }],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('throws NotFoundException when composition not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', { name: 'New' })).rejects.toThrow(NotFoundException);
    });

    it('updates name and description', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)
        .mockResolvedValueOnce({ ...comp, name: 'New Name', entries: [] });
      mockCompositionRepo.save.mockResolvedValue({ ...comp, name: 'New Name' });

      const result = await service.update('comp-1', { name: 'New Name' });

      expect(mockCompositionRepo.save).toHaveBeenCalled();
      expect(result.name).toBe('New Name');
    });

    it('replaces all entries when entries provided', async () => {
      const comp = makeComposition({ entries: [makeEntry()] });
      mockCompositionRepo.findOne
        .mockResolvedValueOnce(comp)
        .mockResolvedValueOnce({ ...comp, entries: [] });
      mockCompositionRepo.save.mockResolvedValue(comp);
      mockEntryRepo.delete.mockResolvedValue({});
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockEntryRepo.create.mockImplementation((dto) => dto);
      mockEntryRepo.save.mockResolvedValue([]);

      await service.update('comp-1', {
        entries: [{ figureTemplateId: 'tmpl-1', offsetX: 200 }],
      });

      expect(mockEntryRepo.delete).toHaveBeenCalledWith({ composition: { id: 'comp-1' } });
      expect(mockEntryRepo.save).toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('throws NotFoundException when not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('missing')).rejects.toThrow(NotFoundException);
    });

    it('removes the composition', async () => {
      const comp = makeComposition();
      mockCompositionRepo.findOne.mockResolvedValue(comp);
      mockCompositionRepo.remove.mockResolvedValue(undefined);

      await service.remove('comp-1');

      expect(mockCompositionRepo.remove).toHaveBeenCalledWith(comp);
    });
  });

  describe('duplicate', () => {
    it('throws NotFoundException when source not found', async () => {
      mockCompositionRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('missing')).rejects.toThrow(NotFoundException);
    });

    it('creates a copy with " - còpia" suffix and same entries', async () => {
      const entry = makeEntry({ figureTemplate: makeTemplate() });
      const source = makeComposition({ name: 'Altar', entries: [entry] });
      const duplicate = makeComposition({ id: 'comp-2', name: 'Altar - còpia', entries: [entry] });

      mockCompositionRepo.findOne
        .mockResolvedValueOnce(source)
        .mockResolvedValueOnce(duplicate);
      mockCompositionRepo.create.mockReturnValue(duplicate);
      mockCompositionRepo.save.mockResolvedValue(duplicate);
      mockEntryRepo.create.mockImplementation((dto) => dto);
      mockEntryRepo.save.mockResolvedValue([]);

      const result = await service.duplicate('comp-1');

      expect(result.name).toBe('Altar - còpia');
      const saveCall = mockCompositionRepo.save.mock.calls[0][0];
      expect(saveCall.name).toBe('Altar - còpia');
    });
  });
});
