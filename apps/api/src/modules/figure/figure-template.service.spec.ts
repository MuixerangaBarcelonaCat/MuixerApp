import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FigureTemplateService } from './figure-template.service';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { Rengla } from './entities/rengla.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
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
    findOne: jest.fn(),
  };

  const mockInstanceNodeQb = {
    innerJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getRawOne: jest.fn().mockResolvedValue({ count: '0' }),
  };

  const mockInstanceNodeRepo = {
    createQueryBuilder: jest.fn(() => mockInstanceNodeQb),
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
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Rengla), useValue: mockRenglaRepo },
        { provide: getRepositoryToken(CompositionSlot), useValue: mockCompositionSlotRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockFigureInstanceRepo },
        { provide: getRepositoryToken(InstanceNode), useValue: mockInstanceNodeRepo },
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

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.findOne('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates template with slug and name', async () => {
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
    it('creates a copy with modified name', async () => {
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

  describe('saveFromInstance', () => {
    const makeInstanceNode = (overrides = {}) => ({
      id: 'in-1',
      label: 'MANS',
      zone: FigureZone.PINYA,
      positionType: 'mans',
      x: 100,
      y: 200,
      z: 0,
      width: 80,
      height: 40,
      rotation: 0,
      color: '#FFE082',
      shape: NodeShape.RECTANGLE,
      sortOrder: 0,
      climbPath: null,
      ringLevel: 1,
      renglaId: null,
      renglaPosition: null,
      metadata: {},
      isAdHoc: false,
      sourceNodeId: null,
      originNodeId: null,
      createdById: null,
      createdAt: new Date(),
      ...overrides,
    });

    it('throws NotFoundException when template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(
        service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'overwrite',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when instance not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockFigureInstanceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'overwrite',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when instance is not snapshotted', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockFigureInstanceRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        snapshotted: false,
        figureTemplate: { id: 'tmpl-uuid' },
        instanceNodes: [makeInstanceNode()],
      });
      await expect(
        service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'overwrite',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when instance belongs to different template', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockFigureInstanceRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        snapshotted: true,
        figureTemplate: { id: 'other-template-id' },
        instanceNodes: [makeInstanceNode()],
      });
      await expect(
        service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'overwrite',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('filters out DECORATION and DIRECTION zones', async () => {
      const tmpl = makeTemplate({ nodes: [makeNode()] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockFigureInstanceRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        snapshotted: true,
        figureTemplate: { id: 'tmpl-uuid' },
        instanceNodes: [
          makeInstanceNode({ id: 'pinya-node', zone: FigureZone.PINYA }),
          makeInstanceNode({ id: 'deco-node', zone: FigureZone.DECORATION }),
          makeInstanceNode({ id: 'dir-node', zone: FigureZone.FIGURE_DIRECTION }),
          makeInstanceNode({ id: 'base-node', zone: FigureZone.BASE }),
        ],
      });
      mockNodeRepo.save.mockResolvedValue([]);
      mockNodeRepo.delete.mockResolvedValue(undefined);

      await service.saveFromInstance('tmpl-uuid', {
        instanceId: 'inst-1',
        mode: 'overwrite',
      });

      // syncNodes should have been called — the created nodes should only be PINYA + BASE (2 nodes)
      const createCalls = mockNodeRepo.create.mock.calls;
      const createdZones = createCalls.map((c) => c[0].zone);
      expect(createdZones).not.toContain(FigureZone.DECORATION);
      expect(createdZones).not.toContain(FigureZone.FIGURE_DIRECTION);
    });

    it('throws BadRequestException when no saveable nodes', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockFigureInstanceRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        snapshotted: true,
        figureTemplate: { id: 'tmpl-uuid' },
        instanceNodes: [
          makeInstanceNode({ zone: FigureZone.DECORATION }),
        ],
      });
      await expect(
        service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'overwrite',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates new template on new_version mode', async () => {
      const tmpl = makeTemplate({ rengles: [makeRengla()] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce(null) // assertSlugAvailable
        .mockResolvedValueOnce({ ...tmpl, nodes: [makeNode()], rengles: [makeRengla()] }); // findOne at end
      mockFigureInstanceRepo.findOne.mockResolvedValue({
        id: 'inst-1',
        snapshotted: true,
        figureTemplate: { id: 'tmpl-uuid' },
        instanceNodes: [makeInstanceNode()],
      });
      mockTemplateRepo.save.mockResolvedValue({ ...makeTemplate(), id: 'new-tmpl' });
      mockRenglaRepo.save.mockResolvedValue([]);
      mockNodeRepo.save.mockResolvedValue([]);

      // Mock suggestVersionName query
      templateQb.getMany.mockResolvedValue([]);

      await service.saveFromInstance('tmpl-uuid', {
        instanceId: 'inst-1',
        mode: 'new_version',
        name: 'Pilar de 4 v2',
      });

      expect(mockTemplateRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Pilar de 4 v2' }),
      );
      expect(mockTemplateRepo.save).toHaveBeenCalled();
    });
  });

  describe('suggestVersionName', () => {
    it('suggests v2 when no versions exist', async () => {
      templateQb.getMany.mockResolvedValue([]);
      const name = await service.suggestVersionName('Pilar de 4');
      expect(name).toBe('Pilar de 4 v2');
    });

    it('suggests v3 when v2 exists', async () => {
      templateQb.getMany.mockResolvedValue([
        makeTemplate({ name: 'Pilar de 4 v2' }),
      ]);
      const name = await service.suggestVersionName('Pilar de 4');
      expect(name).toBe('Pilar de 4 v3');
    });

    it('strips existing version suffix', async () => {
      templateQb.getMany.mockResolvedValue([
        makeTemplate({ name: 'Pilar de 4 v2' }),
        makeTemplate({ name: 'Pilar de 4 v3' }),
      ]);
      const name = await service.suggestVersionName('Pilar de 4 v2');
      expect(name).toBe('Pilar de 4 v4');
    });
  });
});
