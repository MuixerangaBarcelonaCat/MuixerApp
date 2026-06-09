import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NodeAssignmentService, isNodeVisible } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Event } from '../event/event.entity';
import { EventType, FigureZone, NodeShape } from '@muixer/shared';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'instance-uuid-1';
const INSTANCE_NODE_ID = 'inode-uuid-1';
const FIGURE_NODE_ID = 'fnode-uuid-1';
const PERSON_ID = 'person-uuid-1';
const ASSIGNMENT_ID = 'assignment-uuid-1';
const ASSIGNMENT_ID_B = 'assignment-uuid-2';
const TEMPLATE_ID = 'template-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

const makePerson = (id = PERSON_ID) => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
});

const makeFigureNode = (overrides: Partial<FigureNode> = {}): Partial<FigureNode> => ({
  id: FIGURE_NODE_ID,
  label: 'MANS',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 500,
  y: 400,
  z: 0,
  width: 80,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.RECTANGLE,
  sortOrder: 5,
  climbPath: null,
  ringLevel: 1,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  metadata: {},
  ...overrides,
});

const makeInstanceNode = (overrides: Partial<InstanceNode> = {}): Partial<InstanceNode> => ({
  id: INSTANCE_NODE_ID,
  label: 'MANS',
  zone: FigureZone.PINYA,
  positionType: 'mans',
  x: 500,
  y: 400,
  z: 0,
  width: 80,
  height: 40,
  rotation: 0,
  color: null,
  shape: NodeShape.RECTANGLE,
  sortOrder: 5,
  climbPath: null,
  ringLevel: 1,
  sourceNodeId: FIGURE_NODE_ID,
  originNodeId: null,
  renglaId: null,
  renglaPosition: null,
  metadata: {},
  ...overrides,
});

const makeSegment = () => ({
  id: SEGMENT_ID,
  name: 'Assaig bloc 1',
  event: { id: 'event-uuid-1', title: 'Assaig', date: '2026-05-01' },
});

const makeTemplate = (overrides: any = {}): any => ({
  id: TEMPLATE_ID,
  nodes: [makeFigureNode()],
  ...overrides,
});

const makeInstance = (overrides: Record<string, any> = {}): any => ({
  id: INSTANCE_ID,
  figureTemplate: { id: TEMPLATE_ID },
  compositionTemplate: null,
  segment: makeSegment(),
  snapshotted: true,
  instanceNodes: [makeInstanceNode()],
  assignments: [],
  createdAt: new Date(),
  ...overrides,
});

const makeAssignment = (overrides: Partial<NodeAssignment> = {}): Partial<NodeAssignment> => ({
  id: ASSIGNMENT_ID,
  figureInstance: makeInstance() as any,
  instanceNode: makeInstanceNode() as any,
  person: makePerson() as any,
  compositionSlot: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

// ─── Mock query builder ────────────────────────────────────────────────────

const mockQb = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(null),
};

// ─── Mock transaction manager ──────────────────────────────────────────────

const makeTransactionManager = (savedNodes: any[] = []) => ({
  create: jest.fn((_entity: any, data: any) => ({ ...data, id: 'new-inode-uuid' })),
  save: jest.fn().mockResolvedValue(savedNodes),
  update: jest.fn().mockResolvedValue({}),
});

// ─── Mock repositories ────────────────────────────────────────────────────

const mockAssignmentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockQb),
};

const mockInstanceRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  createQueryBuilder: jest.fn(),
};

const mockInstanceNodeRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn((data: any) => ({ ...data, id: 'new-inode-uuid' })),
  update: jest.fn(),
};

const mockFigureNodeRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockPersonRepo = { findOne: jest.fn() };
const mockSlotRepo = { findOne: jest.fn() };
const mockTemplateRepo = { findOne: jest.fn() };
const mockSegmentRepo = { findOne: jest.fn(), find: jest.fn() };
const mockEventRepo = { findOne: jest.fn() };
const mockDataSource = {
  transaction: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
};

// ─── Suite ────────────────────────────────────────────────────────────────

describe('NodeAssignmentService', () => {
  let service: NodeAssignmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
    process.env.ASSIGNMENT_LOCK_DAYS = '0';
    mockAssignmentRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.innerJoin.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.getOne.mockResolvedValue(null);
    mockDataSource.query.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeAssignmentService,
        { provide: getRepositoryToken(NodeAssignment), useValue: mockAssignmentRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(InstanceNode), useValue: mockInstanceNodeRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockFigureNodeRepo },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
        { provide: getRepositoryToken(CompositionSlot), useValue: mockSlotRepo },
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<NodeAssignmentService>(NodeAssignmentService);
  });

  afterEach(() => {
    delete process.env.ASSIGNMENT_LOCK_DAYS;
  });

  // ── getByInstance ──────────────────────────────────────────────────────

  describe('getByInstance', () => {
    it('returns assignments mapped from instanceNode', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      const a = makeAssignment();
      mockAssignmentRepo.find.mockResolvedValue([a]);

      const result = await service.getByInstance(INSTANCE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ASSIGNMENT_ID);
      expect(result[0].node.id).toBe(INSTANCE_NODE_ID);
      expect(result[0].node.ringLevel).toBe(1);
      expect(result[0].person.id).toBe(PERSON_ID);
    });

    it('returns empty array when no assignments', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockAssignmentRepo.find.mockResolvedValue([]);
      const result = await service.getByInstance(INSTANCE_ID);
      expect(result).toEqual([]);
    });

    it('throws NotFoundException if instance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(service.getByInstance(INSTANCE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getInstanceNodes ───────────────────────────────────────────────────

  describe('getInstanceNodes', () => {
    it('returns snapshotted InstanceNodes with isSnapshotted=true', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockInstanceNodeRepo.find.mockResolvedValue([makeInstanceNode()]);

      const result = await service.getInstanceNodes(INSTANCE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(INSTANCE_NODE_ID);
      expect(result[0].isSnapshotted).toBe(true);
      expect(result[0].sourceNodeId).toBe(FIGURE_NODE_ID);
    });

    it('returns live FigureNodes with isSnapshotted=false for unsnapshotted instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(
        makeInstance({ snapshotted: false, figureTemplate: { id: TEMPLATE_ID } }),
      );
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());

      const result = await service.getInstanceNodes(INSTANCE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(FIGURE_NODE_ID);
      expect(result[0].isSnapshotted).toBe(false);
      expect(result[0].sourceNodeId).toBeNull();
    });

    it('throws NotFoundException if instance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(service.getInstanceNodes(INSTANCE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── assign ────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('auto-snapshots on first assignment when instance is not snapshotted', async () => {
      const unsnapshottedInstance = makeInstance({ snapshotted: false });
      const snapshotNode = makeInstanceNode({ id: 'new-inode-uuid', sourceNodeId: FIGURE_NODE_ID });
      const manager = makeTransactionManager([snapshotNode]);

      mockInstanceRepo.findOne.mockResolvedValue(unsnapshottedInstance);
      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockDataSource.transaction.mockImplementation((cb: any) => cb(manager));
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)   // node not occupied
        .mockResolvedValueOnce(null)   // person not in instance
        .mockResolvedValue(makeAssignment({ instanceNode: snapshotNode as any }));
      mockAssignmentRepo.create.mockReturnValue(makeAssignment({ instanceNode: snapshotNode as any }));
      mockAssignmentRepo.save.mockResolvedValue({ id: ASSIGNMENT_ID });

      const result = await service.assign(INSTANCE_ID, {
        nodeId: FIGURE_NODE_ID,
        personId: PERSON_ID,
      });

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(result.id).toBe(ASSIGNMENT_ID);
    });

    it('does NOT snapshot when instance is already snapshotted', async () => {
      const inode = makeInstanceNode();
      const a = makeAssignment();

      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(a);
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);

      await service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID });

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('throws NotFoundException if instance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if person not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockInstanceNodeRepo.findOne.mockResolvedValue(makeInstanceNode());
      mockPersonRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if InstanceNode not found in this instance (snapshotted)', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockInstanceNodeRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assign(INSTANCE_ID, { nodeId: 'wrong-node', personId: PERSON_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('assigns person to InstanceNode successfully (already snapshotted)', async () => {
      const inode = makeInstanceNode();
      const a = makeAssignment();

      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(a);
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);

      const result = await service.assign(INSTANCE_ID, {
        nodeId: INSTANCE_NODE_ID,
        personId: PERSON_ID,
      });

      expect(result.id).toBe(ASSIGNMENT_ID);
      expect(result.node.id).toBe(INSTANCE_NODE_ID);
    });

    it('throws ConflictException if node already occupied', async () => {
      const inode = makeInstanceNode();
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockAssignmentRepo.findOne.mockResolvedValueOnce(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if person already in instance', async () => {
      const inode = makeInstanceNode();
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if person already in another instance of same segment', async () => {
      const inode = makeInstanceNode();
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockQb.getOne.mockResolvedValue(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── swap ──────────────────────────────────────────────────────────────

  describe('swap', () => {
    const PERSON_ID_B = 'person-uuid-2';
    const makeAssignmentB = () =>
      makeAssignment({
        id: ASSIGNMENT_ID_B,
        instanceNode: makeInstanceNode({ id: 'inode-uuid-2', label: 'AGULLA' }) as any,
        person: makePerson(PERSON_ID_B) as any,
      });

    it('swaps persons between two assignments using raw SQL', async () => {
      const assignmentA = makeAssignment();
      const assignmentB = makeAssignmentB();
      const swappedA = { ...assignmentA, person: assignmentB.person };
      const swappedB = { ...assignmentB, person: assignmentA.person };

      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(assignmentA)   // load A
        .mockResolvedValueOnce(assignmentB)   // load B
        .mockResolvedValueOnce(swappedA)      // reload A after swap
        .mockResolvedValueOnce(swappedB);     // reload B after swap

      const result = await service.swap(INSTANCE_ID, {
        assignmentIdA: ASSIGNMENT_ID,
        assignmentIdB: ASSIGNMENT_ID_B,
      });

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('personId'),
        [ASSIGNMENT_ID, PERSON_ID_B, ASSIGNMENT_ID_B, PERSON_ID],
      );
      expect(result.a.id).toBe(ASSIGNMENT_ID);
      expect(result.b.id).toBe(ASSIGNMENT_ID_B);
    });

    it('throws NotFoundException if assignment A not found', async () => {
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeAssignmentB());

      await expect(
        service.swap(INSTANCE_ID, { assignmentIdA: ASSIGNMENT_ID, assignmentIdB: ASSIGNMENT_ID_B }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if assignment B not found', async () => {
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(makeAssignment())
        .mockResolvedValueOnce(null);

      await expect(
        service.swap(INSTANCE_ID, { assignmentIdA: ASSIGNMENT_ID, assignmentIdB: ASSIGNMENT_ID_B }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if assignments belong to different instances', async () => {
      const assignmentA = makeAssignment();
      const assignmentB = makeAssignment({
        id: ASSIGNMENT_ID_B,
        figureInstance: { ...makeInstance(), id: 'other-instance' } as any,
      });

      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(assignmentA)
        .mockResolvedValueOnce(assignmentB);

      await expect(
        service.swap(INSTANCE_ID, { assignmentIdA: ASSIGNMENT_ID, assignmentIdB: ASSIGNMENT_ID_B }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when swapping an assignment with itself', async () => {
      const assignmentA = makeAssignment();
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(assignmentA)
        .mockResolvedValueOnce(assignmentA);

      await expect(
        service.swap(INSTANCE_ID, { assignmentIdA: ASSIGNMENT_ID, assignmentIdB: ASSIGNMENT_ID }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── unassign ──────────────────────────────────────────────────────────

  describe('unassign', () => {
    it('removes assignment', async () => {
      const a = makeAssignment();
      mockAssignmentRepo.findOne.mockResolvedValue(a);
      mockAssignmentRepo.remove.mockResolvedValue(a);

      await service.unassign(INSTANCE_ID, ASSIGNMENT_ID);
      expect(mockAssignmentRepo.remove).toHaveBeenCalledWith(a);
    });

    it('throws NotFoundException if assignment not found', async () => {
      mockAssignmentRepo.findOne.mockResolvedValue(null);
      await expect(service.unassign(INSTANCE_ID, ASSIGNMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if assignment belongs to different instance', async () => {
      const a = makeAssignment({
        figureInstance: { id: 'other-instance' } as any,
      });
      mockAssignmentRepo.findOne.mockResolvedValue(a);

      await expect(service.unassign(INSTANCE_ID, ASSIGNMENT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getHistory ────────────────────────────────────────────────────────

  describe('getHistory', () => {
    const mockHistoryQb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      mockInstanceRepo.createQueryBuilder = jest.fn().mockReturnValue(mockHistoryQb);
    });

    it('throws NotFoundException if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.getHistory('bad-tmpl')).rejects.toThrow(NotFoundException);
    });

    it('returns paginated history entries with eventType', async () => {
      const tmpl = { id: TEMPLATE_ID };
      const instance = makeInstance({ snapshotted: true });
      instance.assignments = [makeAssignment()];
      instance.segment = { ...makeSegment(), event: { id: 'e1', title: 'Assaig', date: '2026-05-01', eventType: EventType.ASSAIG } };

      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockHistoryQb.getCount.mockResolvedValue(1);
      mockHistoryQb.getMany.mockResolvedValue([instance]);

      const result = await service.getHistory(TEMPLATE_ID);

      expect(result.data).toHaveLength(1);
      expect(result.data[0].eventType).toBe(EventType.ASSAIG);
      expect(result.data[0].familyName).toBeNull();
      expect(result.data[0].instanceId).toBe(INSTANCE_ID);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });

    it('applies seasonId filter when provided', async () => {
      const tmpl = { id: TEMPLATE_ID };
      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockHistoryQb.getCount.mockResolvedValue(0);
      mockHistoryQb.getMany.mockResolvedValue([]);

      await service.getHistory(TEMPLATE_ID, { seasonId: 'season-1' });

      expect(mockHistoryQb.andWhere).toHaveBeenCalledWith(
        'ev.seasonId = :seasonId',
        { seasonId: 'season-1' },
      );
    });
  });

  // ── getPersonHistory ───────────────────────────────────────────────────

  describe('getPersonHistory', () => {
    const mockPersonHistoryQb = {
      innerJoin: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(0),
      getRawMany: jest.fn().mockResolvedValue([]),
    };

    beforeEach(() => {
      mockAssignmentRepo.createQueryBuilder.mockReturnValue(mockPersonHistoryQb);
    });

    it('throws NotFoundException if person not found', async () => {
      mockPersonRepo.findOne.mockResolvedValue(null);
      await expect(service.getPersonHistory('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns paginated entries ordered by event date DESC', async () => {
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockPersonHistoryQb.getCount.mockResolvedValue(2);
      mockPersonHistoryQb.getRawMany.mockResolvedValue([
        {
          eventId: 'e1', eventTitle: 'Diada', eventDate: '2026-05-10',
          eventType: EventType.ACTUACIO, segmentName: 'Bloc 1',
          instanceId: 'fi-1', figureName: 'Muixeranga de 5',
          figureSlug: 'muixeranga-de-5',
          nodeLabel: 'MANS', positionType: 'mans', zone: FigureZone.PINYA, z: 0,
        },
        {
          eventId: 'e2', eventTitle: 'Assaig', eventDate: '2026-05-05',
          eventType: EventType.ASSAIG, segmentName: 'Bloc 2',
          instanceId: 'fi-2', figureName: 'Pilar de 4',
          figureSlug: 'pilar-de-4',
          nodeLabel: 'AGULLA', positionType: 'agulla', zone: FigureZone.PINYA, z: 1,
        },
      ]);

      const result = await service.getPersonHistory(PERSON_ID, { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      expect(result.data[0].eventTitle).toBe('Diada');
      expect(result.data[0].eventType).toBe(EventType.ACTUACIO);
      expect(result.data[0].familyName).toBeNull();
      expect(result.meta.total).toBe(2);
    });

    it('applies seasonId filter when provided', async () => {
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockPersonHistoryQb.getCount.mockResolvedValue(0);
      mockPersonHistoryQb.getRawMany.mockResolvedValue([]);

      await service.getPersonHistory(PERSON_ID, { seasonId: 'season-x' });

      expect(mockPersonHistoryQb.andWhere).toHaveBeenCalledWith(
        'ev.seasonId = :seasonId',
        { seasonId: 'season-x' },
      );
    });

    it('defaults to page=1, limit=20 when not provided', async () => {
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockPersonHistoryQb.getCount.mockResolvedValue(0);
      mockPersonHistoryQb.getRawMany.mockResolvedValue([]);

      const result = await service.getPersonHistory(PERSON_ID);

      expect(result.meta.page).toBe(1);
      expect(result.meta.limit).toBe(20);
    });
  });

  // ── getEventAssignmentSummary ──────────────────────────────────────────

  describe('getEventAssignmentSummary', () => {
    it('throws NotFoundException if event not found', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);
      await expect(service.getEventAssignmentSummary('bad-id')).rejects.toThrow(NotFoundException);
    });

    it('returns segments with figures and assignments', async () => {
      const person = makePerson();
      const iNode = makeInstanceNode();
      const assignment = { ...makeAssignment(), instanceNode: iNode, person };
      const figureInstance = {
        id: 'fi-1',
        figureTemplate: { id: TEMPLATE_ID, name: 'Muixeranga de 5' },
        snapshotted: true,
        instanceNodes: [iNode],
        assignments: [assignment],
      };
      const segment = { id: SEGMENT_ID, name: 'Bloc 1', sortOrder: 1 };

      mockEventRepo.findOne.mockResolvedValue({ id: 'e1' });
      mockSegmentRepo.find.mockResolvedValue([segment]);
      mockInstanceRepo.find.mockResolvedValue([figureInstance]);

      const result = await service.getEventAssignmentSummary('e1');

      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].segmentName).toBe('Bloc 1');
      expect(result.segments[0].figures).toHaveLength(1);
      expect(result.segments[0].figures[0].figureName).toBe('Muixeranga de 5');
      expect(result.segments[0].figures[0].familyName).toBeNull();
      expect(result.segments[0].figures[0].totalNodes).toBe(1);
      expect(result.segments[0].figures[0].assignedNodes).toBe(1);
      expect(result.segments[0].figures[0].assignments[0].personAlias).toBe('Pepet');
    });

    it('returns empty segments array when event has no segments', async () => {
      mockEventRepo.findOne.mockResolvedValue({ id: 'e1' });
      mockSegmentRepo.find.mockResolvedValue([]);

      const result = await service.getEventAssignmentSummary('e1');

      expect(result.segments).toEqual([]);
    });
  });

  // ── bulkImport ────────────────────────────────────────────────────────

  describe('bulkImport', () => {
    it('throws BadRequestException if source instance is not snapshotted', async () => {
      const target = makeInstance({ snapshotted: true });
      const source = makeInstance({ id: 'source-uuid', snapshotted: false });

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(source);

      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('auto-snapshots target if not snapshotted before importing', async () => {
      const unsnapshottedTarget = makeInstance({ snapshotted: false, instanceNodes: [] });
      const source = makeInstance({ id: 'source-uuid', snapshotted: true });
      const snapshotNode = makeInstanceNode({ sourceNodeId: FIGURE_NODE_ID });
      const snapshottedTarget = makeInstance({ snapshotted: true, instanceNodes: [snapshotNode] });
      const manager = makeTransactionManager([snapshotNode]);

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(unsnapshottedTarget) // load target
        .mockResolvedValueOnce(source)              // load source
        .mockResolvedValueOnce(snapshottedTarget);  // reload after snapshot

      mockTemplateRepo.findOne.mockResolvedValue(makeTemplate());
      mockDataSource.transaction.mockImplementation((cb: any) => cb(manager));
      mockAssignmentRepo.find.mockResolvedValue([]); // no source assignments

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(result.created).toHaveLength(0);
    });

    it('throws NotFoundException if target not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'src' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if source not found', async () => {
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance())
        .mockResolvedValueOnce(null);
      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'bad-src' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('records conflict when no matching node found in target', async () => {
      const targetINode = makeInstanceNode({ sourceNodeId: 'other-src', originNodeId: null });
      const target = makeInstance({ snapshotted: true, instanceNodes: [targetINode] });
      const source = makeInstance({ id: 'source-uuid', snapshotted: true });
      const sourceAssignment = makeAssignment({
        figureInstance: source as any,
        instanceNode: makeInstanceNode({ sourceNodeId: 'unmatched-src', originNodeId: null }) as any,
      });

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(target)
        .mockResolvedValueOnce(source);
      mockAssignmentRepo.find.mockResolvedValue([sourceAssignment]);

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toContain('No matching node');
    });
  });

  // ── Assignment lock ──────────────────────────────────────────────────

  describe('checkEventLock', () => {
    const lockedDate = new Date();
    lockedDate.setDate(lockedDate.getDate() - 10);
    const lockedDateStr = lockedDate.toISOString().slice(0, 10);

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 1);
    const recentDateStr = recentDate.toISOString().slice(0, 10);

    const makeLockedInstance = (eventDate: string) =>
      makeInstance({
        segment: {
          id: SEGMENT_ID,
          event: { id: 'event-uuid-1', title: 'Assaig', date: eventDate },
        },
      });

    beforeEach(() => {
      process.env.ASSIGNMENT_LOCK_DAYS = '2';
    });

    it('assign() throws ForbiddenException when event is locked', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeLockedInstance(lockedDateStr));

      await expect(
        service.assign(INSTANCE_ID, { nodeId: INSTANCE_NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('unassign() throws ForbiddenException when event is locked', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeLockedInstance(lockedDateStr));

      await expect(
        service.unassign(INSTANCE_ID, ASSIGNMENT_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('swap() throws ForbiddenException when event is locked', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeLockedInstance(lockedDateStr));

      await expect(
        service.swap(INSTANCE_ID, { assignmentIdA: ASSIGNMENT_ID, assignmentIdB: ASSIGNMENT_ID_B }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('bulkImport() throws ForbiddenException when event is locked', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeLockedInstance(lockedDateStr));

      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'src' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('resetSnapshot() throws ForbiddenException when event is locked', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeLockedInstance(lockedDateStr));

      await expect(
        service.resetSnapshot(INSTANCE_ID),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows assign() when ASSIGNMENT_LOCK_DAYS=0 (lock disabled)', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '0';

      const inode = makeInstanceNode();
      const a = makeAssignment();
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance({ snapshotted: true }));
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(a);
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);

      const result = await service.assign(INSTANCE_ID, {
        nodeId: INSTANCE_NODE_ID,
        personId: PERSON_ID,
      });

      expect(result.id).toBe(ASSIGNMENT_ID);
    });

    it('allows assign() when event is recent (within lock window)', async () => {
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeLockedInstance(recentDateStr))
        .mockResolvedValueOnce(makeInstance({ snapshotted: true }));

      const inode = makeInstanceNode();
      const a = makeAssignment();
      mockInstanceNodeRepo.findOne.mockResolvedValue(inode);
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(a);
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);

      const result = await service.assign(INSTANCE_ID, {
        nodeId: INSTANCE_NODE_ID,
        personId: PERSON_ID,
      });

      expect(result.id).toBe(ASSIGNMENT_ID);
    });
  });

  // ── getLockStatus ───────────────────────────────────────────────────

  describe('getLockStatus', () => {
    it('returns locked=true for old event', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 10);
      process.env.ASSIGNMENT_LOCK_DAYS = '2';

      mockEventRepo.findOne.mockResolvedValue({ id: 'e1', date: oldDate });

      const status = await service.getLockStatus('e1');

      expect(status.locked).toBe(true);
      expect(status.lockDays).toBe(2);
      expect(status.lockDate).toBeDefined();
    });

    it('returns locked=false for recent event', async () => {
      const today = new Date();
      process.env.ASSIGNMENT_LOCK_DAYS = '2';

      mockEventRepo.findOne.mockResolvedValue({ id: 'e1', date: today });

      const status = await service.getLockStatus('e1');

      expect(status.locked).toBe(false);
    });

    it('returns locked=false when ASSIGNMENT_LOCK_DAYS=0', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '0';

      mockEventRepo.findOne.mockResolvedValue({ id: 'e1', date: new Date('2020-01-01') });

      const status = await service.getLockStatus('e1');

      expect(status.locked).toBe(false);
      expect(status.lockDays).toBe(0);
    });

    it('throws NotFoundException if event not found', async () => {
      process.env.ASSIGNMENT_LOCK_DAYS = '2';
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.getLockStatus('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getInstanceNodes — cordon filtering', () => {
    it('filters nodes by numberOfCordons', async () => {
      const node1 = makeInstanceNode({ id: 'n1', renglaId: 'r1', renglaPosition: 1, positionType: 'mans' });
      const node2 = makeInstanceNode({ id: 'n2', renglaId: 'r1', renglaPosition: 2, positionType: 'mans' });
      const node3 = makeInstanceNode({ id: 'n3', renglaId: 'r1', renglaPosition: 3, positionType: 'mans' });

      mockInstanceRepo.findOne.mockResolvedValue({
        id: INSTANCE_ID,
        snapshotted: true,
        numberOfCordons: 2,
        openCordons: null,
        figureTemplate: { id: TEMPLATE_ID },
      });
      mockInstanceNodeRepo.find.mockResolvedValue([node1, node2, node3]);

      const result = await service.getInstanceNodes(INSTANCE_ID);
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toEqual(['n1', 'n2']);
    });

    it('shows all nodes when numberOfCordons is null', async () => {
      const node1 = makeInstanceNode({ id: 'n1', renglaId: 'r1', renglaPosition: 1 });
      const node2 = makeInstanceNode({ id: 'n2', renglaId: 'r1', renglaPosition: 2 });

      mockInstanceRepo.findOne.mockResolvedValue({
        id: INSTANCE_ID,
        snapshotted: true,
        numberOfCordons: null,
        openCordons: null,
        figureTemplate: { id: TEMPLATE_ID },
      });
      mockInstanceNodeRepo.find.mockResolvedValue([node1, node2]);

      const result = await service.getInstanceNodes(INSTANCE_ID);
      expect(result).toHaveLength(2);
    });

    it('shows cordo-obert only for rengles in openCordons', async () => {
      const regularNode = makeInstanceNode({ id: 'n1', renglaId: 'r1', renglaPosition: 1, positionType: 'mans' });
      const cordoObertNode = makeInstanceNode({ id: 'n2', renglaId: 'r1', renglaPosition: 2, positionType: 'cordo-obert' });
      const cordoObertOther = makeInstanceNode({ id: 'n3', renglaId: 'r2', renglaPosition: 2, positionType: 'cordo-obert' });

      mockInstanceRepo.findOne.mockResolvedValue({
        id: INSTANCE_ID,
        snapshotted: true,
        numberOfCordons: null,
        openCordons: ['r1'],
        figureTemplate: { id: TEMPLATE_ID },
      });
      mockInstanceNodeRepo.find.mockResolvedValue([regularNode, cordoObertNode, cordoObertOther]);

      const result = await service.getInstanceNodes(INSTANCE_ID);
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.id)).toEqual(['n1', 'n2']);
    });
  });

  describe('snapshotInstance — rengla propagation', () => {
    it('copies renglaId and renglaPosition from template nodes to instance nodes', async () => {
      const figureNode = makeFigureNode({ renglaId: 'r-uuid', renglaPosition: 2 });
      const savedInstance = {
        id: INSTANCE_ID,
        snapshotted: false,
        numberOfCordons: null,
        openCordons: null,
        figureTemplate: { id: TEMPLATE_ID },
        segment: makeSegment(),
        compositionTemplate: null,
      };

      mockInstanceRepo.findOne.mockResolvedValue(savedInstance);
      mockTemplateRepo.findOne.mockResolvedValue({
        id: TEMPLATE_ID,
        nodes: [figureNode],
      });

      const txManager = makeTransactionManager();
      mockDataSource.transaction.mockImplementation(async (cb: any) => cb(txManager));

      const createdInstanceNode = makeInstanceNode({
        sourceNodeId: figureNode.id,
        renglaId: 'r-uuid',
        renglaPosition: 2,
      });
      txManager.create.mockReturnValue(createdInstanceNode);
      txManager.save.mockResolvedValue([createdInstanceNode]);

      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      mockAssignmentRepo.createQueryBuilder.mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      });

      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockInstanceNodeRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);

      await service.assign(INSTANCE_ID, {
        nodeId: figureNode.id!,
        personId: PERSON_ID,
      });

      const createCalls = txManager.create.mock.calls;
      const instanceNodeCreateCall = createCalls.find(
        (c: unknown[]) => c[0] === InstanceNode,
      );
      expect(instanceNodeCreateCall).toBeDefined();
      const nodeData = instanceNodeCreateCall![1];
      expect(nodeData.renglaId).toBe('r-uuid');
      expect(nodeData.renglaPosition).toBe(2);
    });
  });
});

describe('isNodeVisible (pure function)', () => {
  it('returns true for nodes without renglaId', () => {
    expect(isNodeVisible({ renglaId: null, renglaPosition: null, positionType: 'mans' }, 2, null)).toBe(true);
  });

  it('returns true for nodes without renglaPosition', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: null, positionType: 'mans' }, 2, null)).toBe(true);
  });

  it('returns true when renglaPosition <= numberOfCordons', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 2, positionType: 'mans' }, 3, null)).toBe(true);
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 2, positionType: 'mans' }, 2, null)).toBe(true);
  });

  it('returns false when renglaPosition > numberOfCordons', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 3, positionType: 'mans' }, 2, null)).toBe(false);
  });

  it('shows all cordon nodes when numberOfCordons is null', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 99, positionType: 'mans' }, null, null)).toBe(true);
  });

  it('hides cordo-obert nodes when rengla is not in openCordons', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert' }, null, [])).toBe(false);
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert' }, null, ['r2'])).toBe(false);
  });

  it('shows cordo-obert nodes when rengla is in openCordons', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert' }, null, ['r1'])).toBe(true);
  });

  it('hides cordo-obert when openCordons is null', () => {
    expect(isNodeVisible({ renglaId: 'r1', renglaPosition: 3, positionType: 'cordo-obert' }, null, null)).toBe(false);
  });
});
