import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { FigureTemplateService } from './figure-template.service';
import { FigureFamily } from './entities/figure-family.entity';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { FigureFamilyNode } from './entities/figure-family-node.entity';
import { Rengla } from './entities/rengla.entity';
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
  rengles: [],
  instances: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureTemplate);

const makeFamilyNode = (overrides: Partial<FigureFamilyNode> = {}): FigureFamilyNode => ({
  id: 'family-node-uuid',
  label: 'Alçadora',
  zone: FigureZone.TRONC,
  positionType: 'alcadora',
  x: 0,
  y: 0,
  z: 1,
  width: 1,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.RECTANGLE,
  sortOrder: 0,
  climbPath: null,
  ringLevel: null,
  renglaId: null,
  renglaPosition: null,
  metadata: {},
  family: null as unknown as FigureFamily,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureFamilyNode);

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
  renglaId: null,
  renglaPosition: null,
  metadata: {},
  template: null as unknown as FigureTemplate,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
} as FigureNode);

const makeRengla = (overrides: Partial<Rengla> = {}): Rengla => ({
  id: 'rengla-uuid',
  name: 'Mans Nord',
  sortOrder: 0,
  startPosition: 1,
  allowsCordoObert: false,
  template: null as unknown as FigureTemplate,
  createdAt: new Date(),
  ...overrides,
} as Rengla);

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
    createQueryBuilder: jest.fn(),
  };

  const mockFamilyNodeRepo = {
    create: jest.fn((dto) => dto),
    save: jest.fn(),
    delete: jest.fn().mockResolvedValue(undefined),
    find: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
  };

  const mockRenglaRepo = {
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
        { provide: getRepositoryToken(FigureFamilyNode), useValue: mockFamilyNodeRepo },
        { provide: getRepositoryToken(Rengla), useValue: mockRenglaRepo },
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

    it('merges family nodes into the response with originNodeId=null', async () => {
      const family = makeFamily();
      const tmpl = makeTemplate({ family, nodes: [makeNode()] });
      const familyNode = makeFamilyNode();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([familyNode]);

      const result = await service.findOne('tmpl-uuid');

      expect(result.nodes).toHaveLength(2);
      const tronc = result.nodes.find((n) => n.zone === FigureZone.TRONC);
      expect(tronc).toBeDefined();
      expect(tronc!.id).toBe('family-node-uuid');
      expect(tronc!.originNodeId).toBeNull(); // Family nodes are canonical
    });

    it('returns only template nodes when family has no family nodes', async () => {
      const family = makeFamily();
      const tmpl = makeTemplate({ family, nodes: [makeNode()] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([]);

      const result = await service.findOne('tmpl-uuid');
      expect(result.nodes).toHaveLength(1);
      expect(result.nodes[0].zone).toBe(FigureZone.PINYA);
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

  });

  describe('update — syncNodes zone routing', () => {
    it('routes TRONC/BASE nodes to familyNodeRepo, not nodeRepo', async () => {
      const family = makeFamily();
      const tmpl = makeTemplate({ family, nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([]); // no existing family nodes

      const troncDto = {
        label: 'Alçadora',
        zone: FigureZone.TRONC,
        positionType: 'alcadora',
        x: 0, y: 0, z: 1, width: 1, height: 40,
        shape: NodeShape.RECTANGLE,
      };

      await service.update('tmpl-uuid', { nodes: [troncDto] });

      // Family node created, NOT a template node
      expect(mockFamilyNodeRepo.save).toHaveBeenCalled();
      expect(mockNodeRepo.save).not.toHaveBeenCalled();
    });

    it('routes PINYA nodes to nodeRepo, not familyNodeRepo', async () => {
      const family = makeFamily();
      const tmpl = makeTemplate({ family, nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([]);

      await service.update('tmpl-uuid', { nodes: [NODE_DTO] });

      expect(mockNodeRepo.save).toHaveBeenCalled();
    });

    it('updates existing family node by ID', async () => {
      const family = makeFamily();
      const existingFamilyNode = makeFamilyNode({ id: 'fn-uuid' });
      const tmpl = makeTemplate({ family, nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([existingFamilyNode]);

      await service.update('tmpl-uuid', {
        nodes: [{ id: 'fn-uuid', label: 'Alçadora', zone: FigureZone.TRONC, positionType: 'alcadora', x: 0, y: 0, z: 1, width: 2, height: 40, shape: NodeShape.RECTANGLE }],
      });

      const saved = mockFamilyNodeRepo.save.mock.calls[0][0];
      expect(saved[0].id).toBe('fn-uuid');
      expect(saved[0].width).toBe(2);
    });

    it('deletes removed family nodes from family table', async () => {
      const family = makeFamily();
      const existingFamilyNode = makeFamilyNode({ id: 'fn-to-delete' });
      const tmpl = makeTemplate({ family, nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockFamilyNodeRepo.find.mockResolvedValue([existingFamilyNode]);

      // Send empty nodes — removes the family node
      await service.update('tmpl-uuid', { nodes: [] });

      expect(mockFamilyNodeRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.objectContaining({ _value: expect.arrayContaining(['fn-to-delete']) }),
        }),
      );
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

    it('does NOT copy TRONC/BASE nodes — they are shared at family level', async () => {
      const family = makeFamily();
      const troncNode = makeNode({ id: 'tronc-node', zone: FigureZone.TRONC, positionType: 'alcadora' });
      const pinyaNode = makeNode({ id: 'pinya-node', zone: FigureZone.PINYA });
      const original = makeTemplate({ nodes: [pinyaNode, troncNode], family });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);
      const copyTemplate = makeTemplate({ id: 'copy-uuid', family });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      templateQb.getRawOne.mockResolvedValue({ max: 1 });
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [] });
      mockFamilyNodeRepo.find.mockResolvedValue([]);

      await service.duplicate('tmpl-uuid');

      const savedNodes = mockNodeRepo.save.mock.calls[0]?.[0] ?? [];
      expect(savedNodes.every((n: any) => n.zone !== FigureZone.TRONC && n.zone !== FigureZone.BASE)).toBe(true);
      expect(savedNodes.some((n: any) => n.zone === FigureZone.PINYA)).toBe(true);
    });

    it('throws NotFoundException when original not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncRengles', () => {
    it('creates new rengles when template has none', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockRenglaRepo.find.mockResolvedValue([]);

      await service.update('tmpl-uuid', {
        rengles: [{ name: 'Mans Nord', sortOrder: 0, startPosition: 1 }],
      });

      expect(mockRenglaRepo.save).toHaveBeenCalled();
      const saved = mockRenglaRepo.save.mock.calls[0][0];
      expect(saved).toHaveLength(1);
      expect(saved[0].name).toBe('Mans Nord');
    });

    it('updates existing rengla by ID', async () => {
      const existing = makeRengla({ id: 'rengla-1' });
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [existing] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockRenglaRepo.find.mockResolvedValue([existing]);

      await service.update('tmpl-uuid', {
        rengles: [{ id: 'rengla-1', name: 'Mans Sud', sortOrder: 1 }],
      });

      const saved = mockRenglaRepo.save.mock.calls[0][0];
      expect(saved[0].name).toBe('Mans Sud');
      expect(saved[0].sortOrder).toBe(1);
    });

    it('deletes absent rengles and orphans their nodes', async () => {
      const existing = makeRengla({ id: 'rengla-to-delete' });
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockRenglaRepo.find.mockResolvedValue([existing]);

      const mockNodeQb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockNodeRepo.createQueryBuilder = jest.fn().mockReturnValue(mockNodeQb);

      await service.update('tmpl-uuid', { rengles: [] });

      expect(mockNodeQb.set).toHaveBeenCalledWith({ renglaId: null, renglaPosition: null });
      expect(mockRenglaRepo.delete).toHaveBeenCalled();
    });

    it('backwards compat: update without rengles field leaves rengles untouched', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', { name: 'Updated Name' });

      expect(mockRenglaRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('findOne — rengles', () => {
    it('returns empty rengles array for template without rengles', async () => {
      const tmpl = makeTemplate({ nodes: [makeNode()], rengles: [] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);

      const result = await service.findOne('tmpl-uuid');
      expect(result.rengles).toEqual([]);
    });

    it('maps rengles in detail response', async () => {
      const rengla = makeRengla({ id: 'r1', name: 'Mans Nord', sortOrder: 0, startPosition: 1, allowsCordoObert: true });
      const tmpl = makeTemplate({ nodes: [], rengles: [rengla] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);

      const result = await service.findOne('tmpl-uuid');
      expect(result.rengles).toHaveLength(1);
      expect(result.rengles[0]).toEqual({
        id: 'r1',
        name: 'Mans Nord',
        sortOrder: 0,
        startPosition: 1,
        allowsCordoObert: true,
      });
    });

    it('includes renglaId and renglaPosition in node items', async () => {
      const node = makeNode({ renglaId: 'rengla-1', renglaPosition: 2 });
      const tmpl = makeTemplate({ nodes: [node], rengles: [] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);

      const result = await service.findOne('tmpl-uuid');
      expect(result.nodes[0].renglaId).toBe('rengla-1');
      expect(result.nodes[0].renglaPosition).toBe(2);
    });
  });

  describe('update — rengla fields on nodes', () => {
    it('preserves renglaId and renglaPosition on node update', async () => {
      const existingNode = makeNode({ id: 'node-1', renglaId: 'r1', renglaPosition: 3 });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [{ ...NODE_DTO, id: 'node-1', renglaId: 'r1', renglaPosition: 3 }],
      });

      const saved = mockNodeRepo.save.mock.calls[0][0];
      expect(saved[0].renglaId).toBe('r1');
      expect(saved[0].renglaPosition).toBe(3);
    });

    it('includes renglaId and renglaPosition when creating new nodes', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [{ ...NODE_DTO, renglaId: 'r1', renglaPosition: 1 }],
      });

      const saved = mockNodeRepo.save.mock.calls[0][0];
      expect(saved[0].renglaId).toBe('r1');
      expect(saved[0].renglaPosition).toBe(1);
    });
  });
});
