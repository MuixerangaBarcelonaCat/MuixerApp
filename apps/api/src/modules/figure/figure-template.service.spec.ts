import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FigureTemplateService } from './figure-template.service';
import { FigureTemplate } from './entities/figure-template.entity';
import { FigureNode } from './entities/figure-node.entity';
import { Rengla } from './entities/rengla.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

const makeTemplate = (overrides: Partial<FigureTemplate> = {}): FigureTemplate => ({
  id: 'tmpl-uuid',
  name: 'Pilar de 4 — 2C',
  slug: 'pd4-2c',
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
  climbIndicator: null,
  ringLevel: 1,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  standsOnNodeIds: [],
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
  let nodeQb: Record<string, jest.Mock>;

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

  const mockManager = {
    getRepository: jest.fn((entity) => {
      if (entity === FigureTemplate) return mockTemplateRepo;
      if (entity === FigureNode) return mockNodeRepo;
      if (entity === Rengla) return mockRenglaRepo;
      throw new Error(`No mock repository registered for ${entity}`);
    }),
  };

  const mockDataSource = {
    transaction: jest.fn((cb: (manager: typeof mockManager) => Promise<unknown>) =>
      cb(mockManager),
    ),
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

    nodeQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      addGroupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    mockNodeRepo.createQueryBuilder.mockReturnValue(nodeQb);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FigureTemplateService,
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Rengla), useValue: mockRenglaRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockFigureInstanceRepo },
        { provide: getRepositoryToken(InstanceNode), useValue: mockInstanceNodeRepo },
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

    it('uses pagination values', async () => {
      templateQb.getMany.mockResolvedValue([makeTemplate()]);
      templateQb.getCount.mockResolvedValue(1);
      await service.findAll({ page: 2, limit: 10 });
      expect(templateQb.skip).toHaveBeenCalledWith(10);
      expect(templateQb.take).toHaveBeenCalledWith(10);
    });

    it('folds the tronc/base aggregate into a bottom-to-top troncProfile per template', async () => {
      templateQb.getMany.mockResolvedValue([makeTemplate({ id: 'tmpl-a' })]);
      nodeQb.getRawMany.mockResolvedValue([
        { templateId: 'tmpl-a', z: 0, count: '4' },
        { templateId: 'tmpl-a', z: 1, count: '4' },
        { templateId: 'tmpl-a', z: 2, count: '2' },
      ]);
      const result = await service.findAll({});
      expect(result.data[0].troncProfile).toEqual([4, 4, 2]);
      expect(nodeQb.where).toHaveBeenCalledWith(
        'node.templateId IN (:...ids)',
        { ids: ['tmpl-a'] },
      );
      expect(nodeQb.andWhere).toHaveBeenCalledWith(
        'node.zone IN (:...zones)',
        { zones: [FigureZone.TRONC, FigureZone.BASE] },
      );
    });

    it('fills gap floors with 0 and defaults to an empty profile when there are no tronc/base nodes', async () => {
      templateQb.getMany.mockResolvedValue([
        makeTemplate({ id: 'tmpl-gap' }),
        makeTemplate({ id: 'tmpl-empty' }),
      ]);
      nodeQb.getRawMany.mockResolvedValue([
        { templateId: 'tmpl-gap', z: 0, count: '3' },
        { templateId: 'tmpl-gap', z: 2, count: '1' },
      ]);
      const result = await service.findAll({});
      expect(result.data.find((t) => t.id === 'tmpl-gap')?.troncProfile).toEqual([3, 0, 1]);
      expect(result.data.find((t) => t.id === 'tmpl-empty')?.troncProfile).toEqual([]);
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

    it('computes troncProfile from the loaded nodes, every node counted as one position regardless of width', async () => {
      const tmpl = makeTemplate({
        nodes: [
          makeNode({ zone: FigureZone.BASE, z: 0, width: 80 }),
          makeNode({ zone: FigureZone.BASE, z: 0, width: 80 }),
          makeNode({ zone: FigureZone.TRONC, z: 1, width: 2 }),
          makeNode({ zone: FigureZone.TRONC, z: 1, width: 2 }),
          makeNode({ zone: FigureZone.PINYA, z: 2, width: 999 }),
        ],
      });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      const result = await service.findOne('tmpl-uuid');
      expect(result.troncProfile).toEqual([2, 2]);
    });
  });

  describe('create', () => {
    it('creates template with slug and name', async () => {
      const saved = makeTemplate({ id: 'new-uuid' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertNameAvailable: name not taken
        .mockResolvedValueOnce(null) // generateUniqueSlug: slug not taken
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

    it('throws ConflictException when name already exists, matching update()', async () => {
      const existing = makeTemplate({ id: 'existing-uuid', name: 'Trobada', slug: 'trobada' });
      mockTemplateRepo.findOne.mockResolvedValueOnce(existing); // assertNameAvailable: "Trobada" taken

      await expect(
        service.create({ name: 'Trobada', slug: 'trobada', nodes: [] }),
      ).rejects.toThrow(ConflictException);
      expect(mockTemplateRepo.save).not.toHaveBeenCalled();
    });

    it('logs the original error before throwing 500 on an unexpected DB failure', async () => {
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertNameAvailable: name not taken
        .mockResolvedValueOnce(null); // generateUniqueSlug: slug not taken
      const dbError = { code: '55000', message: 'some other db failure' };
      mockTemplateRepo.save.mockRejectedValueOnce(dbError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      await expect(
        service.create({ name: 'Pilar de 4', slug: 'pd4', nodes: [] }),
      ).rejects.toThrow(InternalServerErrorException);
      expect(errorSpy).toHaveBeenCalledWith(dbError);
    });

    it('keeps the client-provided node ids so later autosaves match them', async () => {
      const saved = makeTemplate({ id: 'new-uuid' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null) // assertNameAvailable: name not taken
        .mockResolvedValueOnce(null) // generateUniqueSlug: slug not taken
        .mockResolvedValueOnce({ ...saved, nodes: [] }); // findOne after create
      mockTemplateRepo.save.mockResolvedValue(saved);

      await service.create({
        name: 'Pilar de 4',
        slug: 'pd4',
        nodes: [{ ...NODE_DTO, id: 'client-node-id' }],
      });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0].id).toBe('client-node-id');
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

    it('creates a new node under the client-provided id, so the next autosave updates it in place', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', { nodes: [{ ...NODE_DTO, id: 'client-node-id' }] });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0].id).toBe('client-node-id');
    });

    it('lets the database generate the id when a new node comes without one', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', { nodes: [NODE_DTO] });

      const savedNodes = mockNodeRepo.save.mock.calls[0][0];
      expect(savedNodes[0]).not.toHaveProperty('id');
    });

    it('throws ConflictException when a new node id is already used by another template', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(tmpl);
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockNodeRepo.save.mockRejectedValueOnce({
        code: '23505',
        detail: 'Key (id)=(foreign-node-id) already exists.',
      });

      await expect(
        service.update('tmpl-uuid', { nodes: [{ ...NODE_DTO, id: 'foreign-node-id' }] }),
      ).rejects.toThrow(ConflictException);
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

    it('runs template save, node sync and rengla sync inside a single transaction (SM-11)', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
      mockRenglaRepo.find.mockResolvedValue([]);

      await service.update('tmpl-uuid', {
        nodes: [NODE_DTO],
        rengles: [{ name: 'Mans Nord', sortOrder: 0 }],
      });

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
    });

    it('rolls back node and rengla writes when the template save fails mid-transaction', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(tmpl);
      mockTemplateRepo.save.mockRejectedValueOnce({ code: '55000' });

      await expect(
        service.update('tmpl-uuid', {
          nodes: [NODE_DTO],
          rengles: [{ name: 'Mans Nord', sortOrder: 0 }],
        }),
      ).rejects.toThrow(InternalServerErrorException);

      // syncNodes/syncRengles never ran because handleDbError threw first, inside the same transaction
      expect(mockNodeRepo.save).not.toHaveBeenCalled();
      expect(mockRenglaRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('standsOnNodeIds', () => {
    const BASE_DTO = { ...NODE_DTO, zone: FigureZone.BASE, positionType: 'base', z: 0 };
    const TRONC_DTO = { ...NODE_DTO, zone: FigureZone.TRONC, positionType: 'segona', z: 1 };
    const B1 = '00000000-0000-4000-8000-0000000000b1';
    const B2 = '00000000-0000-4000-8000-0000000000b2';
    const S1 = '00000000-0000-4000-8000-0000000000a1';
    const T1 = '00000000-0000-4000-8000-0000000000c1';

    // The rejecting cases never reach the final findOne, so drop any queued value they leave behind.
    beforeEach(() => mockTemplateRepo.findOne.mockReset());

    const arrangeUpdate = () => {
      const tmpl = makeTemplate({ nodes: [] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);
    };

    it('persists the links of a TRONC node on update', async () => {
      arrangeUpdate();

      await service.update('tmpl-uuid', {
        nodes: [
          { ...BASE_DTO, id: B1 },
          { ...BASE_DTO, id: B2 },
          { ...TRONC_DTO, id: S1, standsOnNodeIds: [B1, B2] },
        ],
      });

      const created = mockNodeRepo.create.mock.calls.map(([n]) => n);
      expect(created.find((n) => n.id === S1).standsOnNodeIds).toEqual([B1, B2]);
      expect(created.find((n) => n.id === B1).standsOnNodeIds).toEqual([]);
    });

    it('updates the links of an existing node in place', async () => {
      const existing = makeNode({ id: S1, zone: FigureZone.TRONC, z: 1, standsOnNodeIds: [] });
      const base = makeNode({ id: B1, zone: FigureZone.BASE, z: 0 });
      const tmpl = makeTemplate({ nodes: [existing, base] });
      mockTemplateRepo.findOne.mockResolvedValueOnce(tmpl).mockResolvedValueOnce(tmpl);
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [
          { ...BASE_DTO, id: B1 },
          { ...TRONC_DTO, id: S1, standsOnNodeIds: [B1] },
        ],
      });

      const saved = mockNodeRepo.save.mock.calls[0][0] as FigureNode[];
      expect(saved.find((n) => n.id === S1)?.standsOnNodeIds).toEqual([B1]);
    });

    it('persists the links on create', async () => {
      const saved = makeTemplate({ id: 'new-uuid' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...saved, nodes: [] });
      mockTemplateRepo.save.mockResolvedValue(saved);

      await service.create({
        name: 'Pilar de 4',
        slug: 'pd4',
        nodes: [{ ...BASE_DTO, id: B1 }, { ...TRONC_DTO, id: S1, standsOnNodeIds: [B1] }],
      });

      const created = mockNodeRepo.create.mock.calls.map(([n]) => n);
      expect(created.find((n) => n.id === S1).standsOnNodeIds).toEqual([B1]);
    });

    it.each([
      ['a node that is not in the payload', { ...TRONC_DTO, id: S1, standsOnNodeIds: [T1] }],
      ['a node two floors below', { ...TRONC_DTO, id: S1, z: 2, standsOnNodeIds: [B1] }],
      ['the node itself', { ...TRONC_DTO, id: S1, standsOnNodeIds: [S1] }],
      ['a non-TRONC holder', { ...BASE_DTO, id: S1, z: 1, standsOnNodeIds: [B1] }],
    ])('rejects an update whose links point at %s', async (_case, holder) => {
      arrangeUpdate();

      await expect(
        service.update('tmpl-uuid', { nodes: [{ ...BASE_DTO, id: B1 }, holder] }),
      ).rejects.toThrow(BadRequestException);
      expect(mockNodeRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a link to a PINYA node', async () => {
      arrangeUpdate();

      await expect(
        service.update('tmpl-uuid', {
          nodes: [
            { ...NODE_DTO, id: B1, z: 0 },
            { ...TRONC_DTO, id: S1, standsOnNodeIds: [B1] },
          ],
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('names the offending node in the error', async () => {
      arrangeUpdate();

      await expect(
        service.update('tmpl-uuid', {
          nodes: [{ ...TRONC_DTO, id: S1, label: 'Segon 1', standsOnNodeIds: [T1] }],
        }),
      ).rejects.toThrow(/Segon 1/);
    });

    it('rejects invalid links on create before saving the template', async () => {
      await expect(
        service.create({
          name: 'Pilar de 4',
          slug: 'pd4',
          nodes: [{ ...TRONC_DTO, id: S1, standsOnNodeIds: [T1] }],
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockTemplateRepo.save).not.toHaveBeenCalled();
    });

    it('returns the links in the node items', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(
        makeTemplate({
          nodes: [
            makeNode({ id: B1, zone: FigureZone.BASE, z: 0 }),
            makeNode({ id: S1, zone: FigureZone.TRONC, z: 1, standsOnNodeIds: [B1] }),
          ],
        }),
      );

      const result = await service.findOne('tmpl-uuid');

      expect(result.nodes.find((n) => n.id === S1)?.standsOnNodeIds).toEqual([B1]);
    });

    it('remaps the links to the copied nodes when duplicating', async () => {
      const original = makeTemplate({
        nodes: [
          makeNode({ id: B1, zone: FigureZone.BASE, z: 0 }),
          makeNode({ id: S1, zone: FigureZone.TRONC, z: 1, standsOnNodeIds: [B1] }),
        ],
      });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeTemplate({ id: 'copy-uuid' }));
      mockTemplateRepo.save.mockResolvedValue(makeTemplate({ id: 'copy-uuid' }));

      await service.duplicate('tmpl-uuid');

      const created = mockNodeRepo.create.mock.calls.map(([n]) => n);
      const copiedBase = created.find((n) => n.zone === FigureZone.BASE);
      const copiedTronc = created.find((n) => n.zone === FigureZone.TRONC);
      expect(copiedTronc.standsOnNodeIds).toEqual([copiedBase.id]);
    });

    describe('saveFromInstance', () => {
      const instanceNode = (id: string, zone: FigureZone, z: number, standsOnNodeIds: string[] = []) => ({
        ...makeNode({ id, zone, z, standsOnNodeIds }),
        isAdHoc: false,
        sourceNodeId: null,
        createdById: null,
      });

      const arrangeInstance = () =>
        mockFigureInstanceRepo.findOne.mockResolvedValue({
          id: 'inst-1',
          snapshotted: true,
          figureTemplate: { id: 'tmpl-uuid' },
          instanceNodes: [
            instanceNode('inode-b1', FigureZone.BASE, 0),
            instanceNode('inode-s1', FigureZone.TRONC, 1, ['inode-b1']),
          ],
        });

      const expectLinksRemapped = () => {
        const created = mockNodeRepo.create.mock.calls.map(([n]) => n);
        const base = created.find((n) => n.zone === FigureZone.BASE);
        const tronc = created.find((n) => n.zone === FigureZone.TRONC);
        expect(base.id).toEqual(expect.any(String));
        expect(base.id).not.toBe('inode-b1');
        expect(tronc.standsOnNodeIds).toEqual([base.id]);
      };

      it('remaps the links from instance node ids to the new template node ids (overwrite)', async () => {
        const tmpl = makeTemplate({ nodes: [] });
        mockTemplateRepo.findOne.mockResolvedValueOnce(tmpl).mockResolvedValueOnce(tmpl);
        arrangeInstance();

        await service.saveFromInstance('tmpl-uuid', { instanceId: 'inst-1', mode: 'overwrite' });

        expectLinksRemapped();
      });

      it('remaps the links from instance node ids to the new template node ids (new_version)', async () => {
        const tmpl = makeTemplate({ nodes: [], rengles: [] });
        mockTemplateRepo.findOne
          .mockResolvedValueOnce(tmpl)
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(tmpl);
        mockTemplateRepo.save.mockResolvedValue({ ...tmpl, id: 'new-tmpl' });
        arrangeInstance();

        await service.saveFromInstance('tmpl-uuid', {
          instanceId: 'inst-1',
          mode: 'new_version',
          name: 'Pilar de 4 v2',
        });

        expectLinksRemapped();
      });
    });
  });

  describe('remove', () => {
    it('removes template', async () => {
      const tmpl = makeTemplate();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockFigureInstanceRepo.count.mockResolvedValue(0);
      mockTemplateRepo.remove.mockResolvedValue(tmpl);

      await service.remove('tmpl-uuid');
      expect(mockTemplateRepo.remove).toHaveBeenCalledWith(tmpl);
    });

    it('throws NotFoundException when not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('throws ConflictException when template is used in figure instances', async () => {
      const tmpl = makeTemplate();
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockFigureInstanceRepo.count.mockResolvedValue(3);
      await expect(service.remove('tmpl-uuid')).rejects.toThrow(ConflictException);
    });
  });

  describe('duplicate', () => {
    it('creates a copy with modified name', async () => {
      const original = makeTemplate({ nodes: [makeNode()] });
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(null) // "(còpia)" name is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockNodeRepo.save.mockResolvedValue([]);

      const result = await service.duplicate('tmpl-uuid');

      expect(result.id).toBe('copy-uuid');
      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toBe('Pilar de 4 — 2C (còpia)');
    });

    it('gives every copied node a fresh id instead of reusing the original one', async () => {
      const original = makeTemplate({
        nodes: [makeNode({ id: 'orig-a' }), makeNode({ id: 'orig-b' })],
      });
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(null) // "(còpia)" name is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.duplicate('tmpl-uuid');

      const savedNodes = mockNodeRepo.save.mock.calls[0][0] as { id?: string }[];
      expect(savedNodes).toHaveLength(2);
      for (const node of savedNodes) {
        expect(node.id).toEqual(expect.any(String));
        expect(['orig-a', 'orig-b']).not.toContain(node.id);
      }
      expect(savedNodes[0].id).not.toBe(savedNodes[1].id);
    });

    it('copies the rengles with fresh ids and points the copied nodes at them', async () => {
      const original = makeTemplate({
        rengles: [
          makeRengla({ id: 'orig-r1', name: 'Mans Nord', sortOrder: 0 }),
          makeRengla({ id: 'orig-r2', name: 'Mans Sud', sortOrder: 1 }),
        ],
        nodes: [
          makeNode({ id: 'orig-a', renglaId: 'orig-r1', renglaPosition: 1 }),
          makeNode({ id: 'orig-b', renglaId: 'orig-r2', renglaPosition: 1 }),
          makeNode({ id: 'orig-c', renglaId: null }),
        ],
      });
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(null) // "(còpia)" name is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockRenglaRepo.save.mockResolvedValue([]);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.duplicate('tmpl-uuid');

      expect(mockTemplateRepo.findOne.mock.calls[0][0].relations).toContain('rengles');
      const savedRengles = mockRenglaRepo.save.mock.calls[0][0] as Partial<Rengla>[];
      expect(savedRengles.map((r) => [r.name, r.sortOrder])).toEqual([
        ['Mans Nord', 0],
        ['Mans Sud', 1],
      ]);
      expect(savedRengles.map((r) => r.template)).toEqual([copyTemplate, copyTemplate]);
      const [r1, r2] = savedRengles.map((r) => r.id);
      expect([r1, r2]).not.toContain('orig-r1');
      expect([r1, r2]).not.toContain('orig-r2');

      const savedNodes = mockNodeRepo.save.mock.calls[0][0] as Partial<FigureNode>[];
      expect(savedNodes.map((n) => [n.renglaId, n.renglaPosition])).toEqual([
        [r1, 1],
        [r2, 1],
        [null, null],
      ]);
    });

    it('drops a node rengla link whose rengla no longer exists in the original', async () => {
      const original = makeTemplate({
        rengles: [],
        nodes: [makeNode({ id: 'orig-a', renglaId: 'deleted-rengla', renglaPosition: 2 })],
      });
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(null) // "(còpia)" name is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);
      mockNodeRepo.save.mockResolvedValue([]);

      await service.duplicate('tmpl-uuid');

      const savedNodes = mockNodeRepo.save.mock.calls[0][0] as Partial<FigureNode>[];
      expect(savedNodes[0].renglaId).toBeNull();
    });

    it('throws NotFoundException when original not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.duplicate('bad-uuid')).rejects.toThrow(NotFoundException);
    });

    it('appends "(còpia 2)" when "(còpia)" name is already taken', async () => {
      const original = makeTemplate({ nodes: [] });
      const existingCopy = makeTemplate({ id: 'copy-uuid-1', name: 'Pilar de 4 — 2C (còpia)' });
      const copyTemplate = makeTemplate({ id: 'copy-uuid-2', name: 'Pilar de 4 — 2C (còpia 2)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(existingCopy) // "(còpia)" is taken
        .mockResolvedValueOnce(null) // "(còpia 2)" is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);

      await service.duplicate('tmpl-uuid');

      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toBe('Pilar de 4 — 2C (còpia 2)');
    });

    it('increments past "(còpia 2)" to "(còpia 3)" when both already exist', async () => {
      const original = makeTemplate({ nodes: [] });
      const copy1 = makeTemplate({ id: 'copy-1', name: 'Pilar de 4 — 2C (còpia)' });
      const copy2 = makeTemplate({ id: 'copy-2', name: 'Pilar de 4 — 2C (còpia 2)' });
      const copyTemplate = makeTemplate({ id: 'copy-3', name: 'Pilar de 4 — 2C (còpia 3)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(copy1) // "(còpia)" is taken
        .mockResolvedValueOnce(copy2) // "(còpia 2)" is taken
        .mockResolvedValueOnce(null) // "(còpia 3)" is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);

      await service.duplicate('tmpl-uuid');

      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toBe('Pilar de 4 — 2C (còpia 3)');
    });

    it('duplicating a template already named "(còpia)" produces "(còpia 2)", not "(còpia) (còpia)"', async () => {
      const original = makeTemplate({ name: 'Pilar de 4 — 2C (còpia)', nodes: [] });
      const copyTemplate = makeTemplate({ id: 'copy-uuid', name: 'Pilar de 4 — 2C (còpia 2)' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(original) // find original
        .mockResolvedValueOnce(original) // "(còpia)" candidate collides with the original itself
        .mockResolvedValueOnce(null) // "(còpia 2)" is free
        .mockResolvedValueOnce(null) // slug is free
        .mockResolvedValueOnce({ ...copyTemplate, nodes: [] }); // final findOne
      mockTemplateRepo.save.mockResolvedValue(copyTemplate);

      await service.duplicate('tmpl-uuid');

      const savedArg = mockTemplateRepo.save.mock.calls[0][0];
      expect(savedArg.name).toBe('Pilar de 4 — 2C (còpia 2)');
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
        rengles: [{ name: 'Mans Nord', sortOrder: 0 }],
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
        .mockResolvedValueOnce(null) // assertNameAvailable
        .mockResolvedValueOnce(null) // generateUniqueSlug check
        .mockResolvedValueOnce({ ...tmpl, rengles: [] }); // findOne at end
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', { name: 'Updated Name' });

      expect(mockRenglaRepo.find).not.toHaveBeenCalled();
    });

    it('rejects update when renaming to an existing name', async () => {
      const tmpl = makeTemplate({ nodes: [] });
      const other = makeTemplate({ id: 'other-uuid', name: 'Trobada' });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce(other);

      await expect(service.update('tmpl-uuid', { name: 'Trobada' })).rejects.toThrow(
        ConflictException,
      );
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
      const rengla = makeRengla({ id: 'r1', name: 'Mans Nord', sortOrder: 0 });
      const tmpl = makeTemplate({ nodes: [], rengles: [rengla] });
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);

      const result = await service.findOne('tmpl-uuid');
      expect(result.rengles).toHaveLength(1);
      expect(result.rengles[0]).toEqual({
        id: 'r1',
        name: 'Mans Nord',
        sortOrder: 0,
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

    it('clears renglaId, renglaPosition and originNodeId when the DTO sends null', async () => {
      const existingNode = makeNode({
        id: 'node-1',
        renglaId: 'r1',
        renglaPosition: 3,
        originNodeId: 'origin-1',
      });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [
          { ...NODE_DTO, id: 'node-1', renglaId: null, renglaPosition: null, originNodeId: null },
        ],
      });

      const saved = mockNodeRepo.save.mock.calls[0][0];
      expect(saved[0].renglaId).toBeNull();
      expect(saved[0].renglaPosition).toBeNull();
      expect(saved[0].originNodeId).toBeNull();
    });

    it('leaves renglaId, renglaPosition and originNodeId untouched when the DTO omits them', async () => {
      const existingNode = makeNode({
        id: 'node-1',
        renglaId: 'r1',
        renglaPosition: 3,
        originNodeId: 'origin-1',
      });
      const tmpl = makeTemplate({ nodes: [existingNode] });
      mockTemplateRepo.findOne
        .mockResolvedValueOnce(tmpl)
        .mockResolvedValueOnce({ ...tmpl, rengles: [] });
      mockTemplateRepo.save.mockResolvedValue(tmpl);

      await service.update('tmpl-uuid', {
        nodes: [{ ...NODE_DTO, id: 'node-1' }],
      });

      const saved = mockNodeRepo.save.mock.calls[0][0];
      expect(saved[0].renglaId).toBe('r1');
      expect(saved[0].renglaPosition).toBe(3);
      expect(saved[0].originNodeId).toBe('origin-1');
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
      climbIndicator: null,
      ringLevel: 1,
      renglaId: null,
      renglaPosition: null,
      standsOnNodeIds: [],
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
          makeInstanceNode({ id: 'dir-node', zone: FigureZone.DIRECTION, positionType: 'direccio-tronc' }),
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
      expect(createdZones).not.toContain(FigureZone.DIRECTION);
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
