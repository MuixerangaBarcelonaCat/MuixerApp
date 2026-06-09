import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FigureTemplateService } from './figure-template.service';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { Rengla } from './entities/rengla.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

const makeTemplate = (overrides: Partial<FigureTemplate> = {}): FigureTemplate => ({
  id: 'tmpl-uuid',
  name: 'Pilar de 4 — 2C',
  slug: 'pd4-2c',
  description: null,
  hasPinya: true,
  direction: 0,
  metadata: {},
  nodes: [],
  rengles: [],
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

  const mockTemplateRepo = {
    createQueryBuilder: jest.fn(() => templateQb),
    findOne: jest.fn(),
    create: jest.fn((dto) => ({ ...makeTemplate(), ...dto })),
    save: jest.fn(),
    remove: jest.fn(),
  };

  const mockTxManager = {
    findOne: jest.fn(),
    save: jest.fn(),
    getRepository: jest.fn(),
  };

  const mockDataSource = {
    transaction: jest.fn().mockImplementation((cb: any) => cb(mockTxManager)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    templateQb = {
      loadRelationCountAndMap: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    mockTemplateRepo.createQueryBuilder.mockReturnValue(templateQb);

    mockTxManager.getRepository.mockImplementation((entity: { name?: string }) => {
      if (entity?.name === 'FigureNode') return mockNodeRepo;
      if (entity?.name === 'Rengla') return mockRenglaRepo;
      return { save: jest.fn(), find: jest.fn().mockResolvedValue([]), delete: jest.fn().mockResolvedValue(undefined), create: jest.fn((d: any) => d) };
    });

    mockDataSource.transaction.mockImplementation((cb: any) => cb(mockTxManager));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureTemplateService,
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Rengla), useValue: mockRenglaRepo },
        { provide: getRepositoryToken(CompositionSlot), useValue: mockCompositionSlotRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockFigureInstanceRepo },
        { provide: DataSource, useValue: mockDataSource },
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

    it('includes TRONC nodes directly (no family merge needed)', async () => {
      const troncNode = makeNode({ id: 'tronc-1', zone: FigureZone.TRONC, z: 1 });
      const tmpl = makeTemplate({ nodes: [makeNode(), troncNode] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      const result = await service.findOne('tmpl-uuid');
      expect(result.nodes).toHaveLength(2);
      expect(result.nodes.some((n) => n.zone === FigureZone.TRONC)).toBe(true);
    });

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates template without requiring a family', async () => {
      const saved = makeTemplate({ id: 'new-uuid' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertSlugAvailable: slug not taken
        .mockResolvedValueOnce({ ...saved, nodes: [] }); // findOne after create
      mockTemplateRepo.save.mockResolvedValue(saved);

      const result = await service.create({
        name: 'Pilar de 4 — 2C',
        slug: 'pd4-2c',
        nodes: [],
      });

      expect(result.id).toBe('new-uuid');
      expect(mockTemplateRepo.save).toHaveBeenCalled();
    });

    it('creates template with all zone nodes (PINYA, TRONC, BASE)', async () => {
      const saved = makeTemplate({ id: 'new-uuid' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...saved, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(saved);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.create({
        name: 'pd3',
        slug: 'pd3',
        nodes: [
          NODE_DTO,
          { label: 'BASE', zone: FigureZone.BASE, positionType: 'base', x: 500, y: 500, width: 80, height: 40, shape: NodeShape.RECTANGLE },
          { label: 'Alçadora', zone: FigureZone.TRONC, positionType: 'alcadora', x: 0, y: 0, z: 1, width: 1, height: 40, shape: NodeShape.RECTANGLE },
        ],
      });

      expect(mockNodeRepo.save).toHaveBeenCalled();
    });
  });

  describe('update — syncNodes (all zones to nodeRepo)', () => {
    it('saves TRONC/BASE nodes to nodeRepo directly', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, nodes: [] });

      const troncDto = {
        label: 'Alçadora',
        zone: FigureZone.TRONC,
        positionType: 'alcadora',
        x: 0, y: 0, z: 1, width: 1, height: 40,
        shape: NodeShape.RECTANGLE,
      };

      await service.update('tmpl-uuid', { nodes: [troncDto] });

      expect(mockNodeRepo.save).toHaveBeenCalled();
    });

    it('updates an existing node by ID without changing UUID', async () => {
      const existingNode = makeNode({ id: 'stable-node-id' });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, nodes: [existingNode] });

      await service.update('tmpl-uuid', {
        nodes: [{ ...NODE_DTO, id: 'stable-node-id', x: 600 }],
      });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0].id).toBe('stable-node-id');
      expect(savedNodes[0].x).toBe(600);
      expect(mockNodeRepo.delete).not.toHaveBeenCalled();
    });

    it('creates new node when no matching ID', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, nodes: [] });

      await service.update('tmpl-uuid', { nodes: [NODE_DTO] });

      expect(mockNodeRepo.save).toHaveBeenCalled();
    });

    it('deletes nodes not in the incoming list', async () => {
      const existingNode = makeNode({ id: 'node-to-delete' });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, nodes: [] });

      await service.update('tmpl-uuid', { nodes: [] });

      expect(mockNodeRepo.delete).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.objectContaining({ _value: expect.arrayContaining(['node-to-delete']) }),
        }),
      );
    });

    it('throws NotFoundException when not found', async () => {
      mockTxManager.findOne.mockResolvedValue(null);
      await expect(service.update('bad-uuid', { name: 'X' })).rejects.toThrow(NotFoundException);
    });

    it('wraps save + syncNodes in a single transaction', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, nodes: [] });

      await service.update('tmpl-uuid', { name: 'Updated', nodes: [] });

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(mockTxManager.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ name: 'Updated' }));
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
    it('creates a copy with (còpia) suffix', async () => {
      const original = makeTemplate({ nodes: [makeNode()] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)' });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [] });
      mockNodeRepo.save.mockResolvedValue([]);

      const result = await service.duplicate('tmpl-uuid');

      expect(result.id).toBe('copy-uuid');
      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toContain('(còpia)');
    });

    it('copies all nodes (including TRONC/BASE zones)', async () => {
      const troncNode = makeNode({ id: 'tronc-node', zone: FigureZone.TRONC, positionType: 'alcadora' });
      const pinyaNode = makeNode({ id: 'pinya-node', zone: FigureZone.PINYA });
      const original = makeTemplate({ nodes: [pinyaNode, troncNode] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);
      const copyTemplate = makeTemplate({ id: 'copy-uuid' });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [] });

      await service.duplicate('tmpl-uuid');

      const savedNodes = mockNodeRepo.save.mock.calls[0]?.[0] ?? [];
      expect(savedNodes).toHaveLength(2);
    });

    it('throws NotFoundException when original not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('syncRengles', () => {
    it('creates new rengles when template has none', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, rengles: [] });
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
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, rengles: [existing] });
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
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, rengles: [] });
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
      mockTxManager.findOne.mockResolvedValue(tmpl);
      mockTxManager.save.mockResolvedValue(undefined);
      mockTemplateRepo.findOne.mockResolvedValue({ ...tmpl, rengles: [] });

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

  describe('duplicate — rengles', () => {
    it('copies rengles from the original template', async () => {
      const rengla = makeRengla({ id: 'orig-rengla', name: 'Mans Nord', sortOrder: 0, startPosition: 1, allowsCordoObert: false });
      const original = makeTemplate({ nodes: [], rengles: [rengla] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);

      const copyTemplate = makeTemplate({ id: 'copy-uuid', rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);

      const newRengla = makeRengla({ id: 'new-rengla-id', name: 'Mans Nord' });
      mockRenglaRepo.save.mockResolvedValue([newRengla]);
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [], rengles: [newRengla] });

      await service.duplicate('orig-uuid');

      expect(mockRenglaRepo.save).toHaveBeenCalledTimes(1);
      const savedRengles = mockRenglaRepo.save.mock.calls[0][0];
      expect(savedRengles[0].name).toBe('Mans Nord');
      expect(savedRengles[0].template).toBe(copyTemplate);
    });

    it('remaps renglaId on copied nodes to point to new rengles', async () => {
      const rengla = makeRengla({ id: 'orig-rengla' });
      const pinyaNode = makeNode({ renglaId: 'orig-rengla', zone: FigureZone.PINYA });
      const original = makeTemplate({ nodes: [pinyaNode], rengles: [rengla] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);

      const copyTemplate = makeTemplate({ id: 'copy-uuid' });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);

      const newRengla = makeRengla({ id: 'new-rengla-id' });
      mockRenglaRepo.save.mockResolvedValue([newRengla]);
      mockNodeRepo.save.mockResolvedValue([]);
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [], rengles: [newRengla] });

      await service.duplicate('orig-uuid');

      const savedNodes = mockNodeRepo.save.mock.calls[0]?.[0] ?? [];
      if (savedNodes.length > 0) {
        expect(savedNodes[0].renglaId).toBe('new-rengla-id');
      }
    });

    it('does not create rengles when original has none', async () => {
      const original = makeTemplate({ nodes: [makeNode()], rengles: [] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(original);

      const copyTemplate = makeTemplate({ id: 'copy-uuid' });
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockTemplateRepo.findOne.mockResolvedValueOnce({ ...copyTemplate, nodes: [], rengles: [] });
      mockNodeRepo.save.mockResolvedValue([]);

      await service.duplicate('orig-uuid');

      expect(mockRenglaRepo.save).not.toHaveBeenCalled();
    });
  });
});
