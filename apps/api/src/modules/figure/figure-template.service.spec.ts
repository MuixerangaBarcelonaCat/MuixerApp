import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FigureTemplateService } from './figure-template.service';
import { FigureFamily } from './entities/figure-family.entity';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

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

const makeTemplate = (overrides: Partial<FigureTemplate> = {}): FigureTemplate => ({
  id: 'tmpl-uuid',
  name: 'Pilar de 4 — 2C',
  slug: 'pd4-2c',
  description: null,
  hasPinya: true,
  direction: 0,
  variantOrder: 1,
  family: null,
  metadata: {},
  nodes: [],
  instances: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureTemplate);

const makeNode = (overrides: Partial<FigureNode> = {}): FigureNode => ({
  id: 'node-uuid',
  label: 'MANS',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 500,
  y: 400,
  z: 0,
  width: 80,
  height: 40,
  rotation: 0,
  color: '#FFE082',
  shape: NodeShape.RECTANGLE,
  sortOrder: 5,
  climbPath: null,
  ringLevel: 1,
  originNodeId: null,
  metadata: {},
  template: null as unknown as FigureTemplate,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureNode);

const NODE_DTO = {
  label: 'MANS',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 500,
  y: 400,
  width: 80,
  height: 40,
  shape: NodeShape.RECTANGLE,
  ringLevel: 1,
};

describe('FigureTemplateService', () => {
  let service: FigureTemplateService;
  let templateQb: Record<string, jest.Mock>;

  const mockNodeRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
  };

  const mockCompositionSlotRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  const mockFigureInstanceRepo = {
    count: jest.fn().mockResolvedValue(0),
  };

  const mockFamilyRepo = {
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockTemplateRepo = {
    createQueryBuilder: jest.fn(() => templateQb),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...makeTemplate(), ...dto })),
    save: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    templateQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
      getRawOne: jest.fn().mockResolvedValue({ max: 0 }),
    };

    mockTemplateRepo.createQueryBuilder.mockReturnValue(templateQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureTemplateService,
        { provide: getRepositoryToken(FigureFamily), useValue: mockFamilyRepo },
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockNodeRepo },
        { provide: getRepositoryToken(CompositionSlot), useValue: mockCompositionSlotRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockFigureInstanceRepo },
      ],
    }).compile();

    service = module.get<FigureTemplateService>(FigureTemplateService);
  });

  describe('findAll', () => {
    it('returns paginated empty list', async () => {
      const result = await service.findAll({});
      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('applies search filter', async () => {
      await service.findAll({ search: 'pd4' });
      expect(templateQb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('ILIKE'),
        expect.objectContaining({ search: '%pd4%' }),
      );
    });

    it('applies hasPinya filter', async () => {
      await service.findAll({ hasPinya: false });
      expect(templateQb.andWhere).toHaveBeenCalledWith(
        'template.hasPinya = :hasPinya',
        { hasPinya: false },
      );
    });

    it('applies familyId filter', async () => {
      await service.findAll({ familyId: 'family-uuid' });
      expect(templateQb.andWhere).toHaveBeenCalledWith(
        'family.id = :familyId',
        { familyId: 'family-uuid' },
      );
    });

    it('uses pagination values', async () => {
      templateQb.getMany.mockResolvedValue([makeTemplate()]);
      templateQb.getCount.mockResolvedValue(1);
      await service.findAll({ page: 2, limit: 10 });
      expect(templateQb.skip).toHaveBeenCalledWith(10);
      expect(templateQb.take).toHaveBeenCalledWith(10);
    });
  });

  describe('findOne', () => {
    it('returns template detail with nodes', async () => {
      const tmpl = makeTemplate({ nodes: [makeNode()] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      const result = await service.findOne('tmpl-uuid');
      expect(result.id).toBe('tmpl-uuid');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].ringLevel).toBe(1);
      expect(result.nodes[0].originNodeId).toBeNull();
    });

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('throws NotFoundException when family not found', async () => {
      mockFamilyRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create({ familyId: 'missing-family', name: 'X', slug: 'x', nodes: [] }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates template linked to family', async () => {
      const family = makeFamily();
      const saved = makeTemplate({ id: 'new-uuid', family });
      mockFamilyRepo.findOne.mockResolvedValue(family);
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertSlugAvailable: slug not taken
        .mockResolvedValueOnce({ ...saved, nodes: [] }); // findOne after create
      mockTemplateRepo.save.mockResolvedValue(saved);

      const result = await service.create({
        familyId: 'family-uuid',
        name: 'Pilar de 4 — 2C',
        slug: 'pd4-2c',
        nodes: [],
      });

      expect(result.id).toBe('new-uuid');
      expect(mockTemplateRepo.save).toHaveBeenCalled();
    });

    it('derives nodes from source template with originNodeId lineage', async () => {
      const family = makeFamily();
      const sourceNode = makeNode({ id: 'source-node', originNodeId: null });
      const sourceTemplate = makeTemplate({ id: 'source-tmpl', nodes: [sourceNode] });
      const saved = makeTemplate({ id: 'new-uuid' });

      mockFamilyRepo.findOne.mockResolvedValue(family);
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertSlugAvailable
        .mockResolvedValueOnce(sourceTemplate) // deriveNodes: load source
        .mockResolvedValueOnce({ ...saved, nodes: [] }); // findOne after create
      mockTemplateRepo.save.mockResolvedValue(saved);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.create({
        familyId: 'family-uuid',
        name: 'Pilar de 4 — 3C',
        slug: 'pd4-3c',
        deriveFromTemplateId: 'source-tmpl',
        nodes: [],
      });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0].originNodeId).toBe('source-node');
    });

    it('preserves originNodeId root ancestor when deriving from a derived template', async () => {
      const family = makeFamily();
      // Already-derived node: originNodeId points to root ancestor
      const derivedNode = makeNode({ id: 'derived-node', originNodeId: 'root-ancestor-id' });
      const derivedTemplate = makeTemplate({ id: 'derived-tmpl', nodes: [derivedNode] });
      const saved = makeTemplate({ id: 'new-uuid' });

      mockFamilyRepo.findOne.mockResolvedValue(family);
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertSlugAvailable
        .mockResolvedValueOnce(derivedTemplate) // deriveNodes
        .mockResolvedValueOnce({ ...saved, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(saved);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.create({
        familyId: 'family-uuid',
        name: 'Pilar de 4 — 4C',
        slug: 'pd4-4c',
        deriveFromTemplateId: 'derived-tmpl',
        nodes: [],
      });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      // Should keep root ancestor, NOT use derivedNode.id
      expect(savedNodes[0].originNodeId).toBe('root-ancestor-id');
    });
  });

  describe('update — upsert sync', () => {
    it('updates an existing node by ID without changing UUID', async () => {
      const existingNode = makeNode({ id: 'stable-node-id' });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [existingNode] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [{ ...NODE_DTO, id: 'stable-node-id', x: 600 }],
      });

      // save called with the updated node (not a new one)
      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0].id).toBe('stable-node-id');
      expect(savedNodes[0].x).toBe(600);
      // no delete for matched node
      expect(mockNodeRepo.delete).not.toHaveBeenCalled();
    });

    it('creates new node when no matching ID', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', { nodes: [NODE_DTO] });

      expect(mockNodeRepo.save).toHaveBeenCalled();
    });

    it('deletes nodes not in the incoming list', async () => {
      const existingNode = makeNode({ id: 'node-to-delete' });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      // incoming list has no node with id 'node-to-delete'
      await service.update('tmpl-uuid', { nodes: [] });

      expect(mockNodeRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.objectContaining({ _value: expect.arrayContaining(['node-to-delete']) }),
        }),
      );
    });

    it('allows editing template that has snapshotted instances (no guard)', async () => {
      const tmpl = makeTemplate({ nodes: [makeNode()] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      // No assignment service involved anymore — should not throw
      await expect(service.update('tmpl-uuid', { nodes: [] })).resolves.not.toThrow();
    });

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('removes template', async () => {
      const tmpl = makeTemplate();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockCompositionSlotRepo.count.mockResolvedValue(0);
      mockFigureInstanceRepo.count.mockResolvedValue(0);
      mockTemplateRepo.remove.mockResolvedValue(tmpl);

      await service.remove('tmpl-uuid');
      expect(mockTemplateRepo.remove).toHaveBeenCalledWith(tmpl);
    });

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when template is used in a composition slot', async () => {
      const tmpl = makeTemplate();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockCompositionSlotRepo.count.mockResolvedValue(2);
      await expect(service.remove('tmpl-uuid')).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException when template is used in figure instances', async () => {
      const tmpl = makeTemplate();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockCompositionSlotRepo.count.mockResolvedValue(0);
      mockFigureInstanceRepo.count.mockResolvedValue(3);
      await expect(service.remove('tmpl-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('duplicate', () => {
    it('creates a copy preserving family link', async () => {
      const family = makeFamily();
      const original = makeTemplate({ nodes: [makeNode()], family });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)', family });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      templateQb.getRawOne.mockResolvedValue({ max: 1 });
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [] });
      mockNodeRepo.save.mockResolvedValue([]);

      const result = await service.duplicate('tmpl-uuid');

      expect(result.id).toBe('copy-uuid');
      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toContain('(còpia)');
    });

    it('throws NotFoundException when original not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
