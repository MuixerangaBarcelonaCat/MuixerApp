import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NodeAssignmentService } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'instance-uuid-1';
const INSTANCE_NODE_ID = 'inode-uuid-1';
const FIGURE_NODE_ID = 'fnode-uuid-1';
const PERSON_ID = 'person-uuid-1';
const ASSIGNMENT_ID = 'assignment-uuid-1';
const ASSIGNMENT_ID_B = 'assignment-uuid-2';
const TEMPLATE_ID = 'template-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const FAMILY_ID = 'family-uuid-1';

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
  variantOrder: 1,
  family: { id: FAMILY_ID },
  nodes: [makeFigureNode()],
  ...overrides,
});

const makeInstance = (overrides: Record<string, any> = {}): any => ({
  id: INSTANCE_ID,
  figureTemplate: { id: TEMPLATE_ID },
  compositionTemplate: null,
  segment: makeSegment(),
  snapshotted: true,
  sourceVariantOrder: 1,
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
const mockSegmentRepo = { findOne: jest.fn() };
const mockDataSource = {
  transaction: jest.fn(),
  query: jest.fn().mockResolvedValue([]),
};

// ─── Suite ────────────────────────────────────────────────────────────────

describe('NodeAssignmentService', () => {
  let service: NodeAssignmentService;

  beforeEach(async () => {
    jest.clearAllMocks();
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
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<NodeAssignmentService>(NodeAssignmentService);
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
    it('throws NotFoundException if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);
      await expect(service.getHistory('bad-tmpl')).rejects.toThrow(NotFoundException);
    });

    it('returns history entries with snapshotted flag and assignments from instanceNodes', async () => {
      const tmpl = { id: TEMPLATE_ID };
      const instance = makeInstance({ instanceNodes: [makeInstanceNode()], snapshotted: true, sourceVariantOrder: 1 });
      instance.assignments = [makeAssignment()];

      mockTemplateRepo.findOne.mockResolvedValue(tmpl);
      mockInstanceRepo.find.mockResolvedValue([instance]);

      const result = await service.getHistory(TEMPLATE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].instanceId).toBe(INSTANCE_ID);
      expect(result[0].snapshotted).toBe(true);
      expect(result[0].sourceVariantOrder).toBe(1);
      expect(result[0].assignments[0].nodeId).toBe(INSTANCE_NODE_ID);
    });
  });

  // ── upgradeInstance ───────────────────────────────────────────────────

  describe('upgradeInstance', () => {
    const NEXT_TEMPLATE_ID = 'template-uuid-2';
    const NEW_NODE_ID = 'fnode-uuid-new';

    const makeNextTemplate = () => ({
      id: NEXT_TEMPLATE_ID,
      name: 'Figure — variant 2',
      variantOrder: 2,
      family: { id: FAMILY_ID },
      nodes: [
        // shared node (same originNodeId + same ringLevel as existing instance node)
        makeFigureNode({ id: 'fnode-shared', originNodeId: FIGURE_NODE_ID }),
        // new node exclusive to variant 2
        makeFigureNode({ id: NEW_NODE_ID, originNodeId: null }),
      ],
    });

    it('adds only new nodes not already in the instance', async () => {
      const instance = makeInstance({
        snapshotted: true,
        sourceVariantOrder: 1,
        figureTemplate: { id: TEMPLATE_ID, variantOrder: 1, family: { id: FAMILY_ID } },
        instanceNodes: [makeInstanceNode({ sourceNodeId: FIGURE_NODE_ID, originNodeId: null })],
      });
      const nextTemplate = makeNextTemplate();

      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockTemplateRepo.findOne.mockResolvedValue(nextTemplate);
      mockInstanceNodeRepo.create.mockImplementation((data: any) => ({ ...data, id: 'saved-inode' }));
      mockInstanceNodeRepo.save.mockResolvedValue([{ id: 'saved-inode' }]);
      mockInstanceRepo.update.mockResolvedValue({});

      const result = await service.upgradeInstance(INSTANCE_ID);

      expect(mockInstanceNodeRepo.save).toHaveBeenCalledTimes(1);
      expect(result.addedNodes).toBe(1);
      expect(result.updatedNodes).toBe(0);
      expect(result.totalNodes).toBe(2);
      expect(result.newTemplateId).toBe(NEXT_TEMPLATE_ID);
      expect(result.newTemplateName).toBe('Figure — variant 2');
      expect(result.newVariantOrder).toBe(2);
      expect(mockInstanceRepo.update).toHaveBeenCalledWith(INSTANCE_ID, {
        figureTemplate: { id: NEXT_TEMPLATE_ID },
        sourceVariantOrder: 2,
      });
    });

    it('auto-snapshots unsnapshotted instance before upgrade', async () => {
      const unsnapshottedInstance = makeInstance({ snapshotted: false, sourceVariantOrder: null });
      const snapshotNode = makeInstanceNode({ sourceNodeId: FIGURE_NODE_ID });
      const snapshotManager = makeTransactionManager([snapshotNode]);

      // First findOne: load for upgrade; after snapshot: reload
      const snapshotted = makeInstance({
        snapshotted: true,
        sourceVariantOrder: 1,
        figureTemplate: { id: TEMPLATE_ID, variantOrder: 1, family: { id: FAMILY_ID } },
        instanceNodes: [snapshotNode],
      });
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(unsnapshottedInstance) // initial load
        .mockResolvedValueOnce(snapshotted);          // reload after snapshot

      mockTemplateRepo.findOne
        .mockResolvedValueOnce(makeTemplate()) // for snapshotInstance
        .mockResolvedValueOnce({              // for nextTemplate
          id: NEXT_TEMPLATE_ID,
          name: 'Figure — variant 2',
          variantOrder: 2,
          family: { id: FAMILY_ID },
          nodes: [makeFigureNode({ id: NEW_NODE_ID, originNodeId: null })],
        });

      mockDataSource.transaction.mockImplementation((cb: any) => cb(snapshotManager));
      mockInstanceNodeRepo.create.mockImplementation((data: any) => ({ ...data, id: 'saved-inode' }));
      mockInstanceNodeRepo.save.mockResolvedValue([{ id: 'saved-inode' }]);
      mockInstanceRepo.update.mockResolvedValue({});

      const result = await service.upgradeInstance(INSTANCE_ID);

      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      expect(result.addedNodes).toBe(1);
      expect(result.updatedNodes).toBe(0);
    });

    it('throws BadRequestException when no larger variant exists', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(
        makeInstance({ snapshotted: true, sourceVariantOrder: 3 }),
      );
      mockTemplateRepo.findOne.mockResolvedValue(null); // no next variant

      await expect(service.upgradeInstance(INSTANCE_ID)).rejects.toThrow(BadRequestException);
    });

    it('throws NotFoundException if instance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);
      await expect(service.upgradeInstance(INSTANCE_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if instance has no figureTemplate', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(
        makeInstance({ figureTemplate: null }),
      );

      await expect(service.upgradeInstance(INSTANCE_ID)).rejects.toThrow(BadRequestException);
    });

    it('adds ring-2 nodes that share originNodeId with existing ring-1 nodes', async () => {
      const existingRing1Node = makeInstanceNode({
        sourceNodeId: FIGURE_NODE_ID,
        originNodeId: null,
        ringLevel: 1,
      });
      const instance = makeInstance({
        snapshotted: true,
        sourceVariantOrder: 1,
        figureTemplate: { id: TEMPLATE_ID, variantOrder: 1, family: { id: FAMILY_ID } },
        instanceNodes: [existingRing1Node],
      });
      const nextTemplate = {
        id: NEXT_TEMPLATE_ID,
        name: 'Figure — variant 2',
        variantOrder: 2,
        family: { id: FAMILY_ID },
        nodes: [
          // ring-1 node sharing same origin → should be filtered out
          makeFigureNode({ id: 'fnode-r1', originNodeId: FIGURE_NODE_ID, ringLevel: 1 }),
          // ring-2 node sharing same origin → should be ADDED (different ringLevel)
          makeFigureNode({ id: 'fnode-r2', originNodeId: FIGURE_NODE_ID, ringLevel: 2 }),
        ],
      };

      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockTemplateRepo.findOne.mockResolvedValue(nextTemplate);
      mockInstanceNodeRepo.create.mockImplementation((data: any) => ({ ...data, id: 'saved-r2' }));
      mockInstanceNodeRepo.save.mockResolvedValue([{ id: 'saved-r2' }]);
      mockInstanceRepo.update.mockResolvedValue({});

      const result = await service.upgradeInstance(INSTANCE_ID);

      expect(result.addedNodes).toBe(1);
      expect(result.updatedNodes).toBe(0);
      const saveArg = mockInstanceNodeRepo.create.mock.calls[0][0] as any;
      expect(saveArg.ringLevel).toBe(2);
    });

    it('adds zero nodes when all next-variant nodes are already in the instance', async () => {
      const existingINode = makeInstanceNode({ sourceNodeId: FIGURE_NODE_ID, originNodeId: null });
      const instance = makeInstance({
        snapshotted: true,
        sourceVariantOrder: 1,
        figureTemplate: { id: TEMPLATE_ID, variantOrder: 1, family: { id: FAMILY_ID } },
        instanceNodes: [existingINode],
      });
      const nextTemplate = {
        id: NEXT_TEMPLATE_ID,
        name: 'Figure — variant 2',
        variantOrder: 2,
        family: { id: FAMILY_ID },
        // all nodes already covered by canonical IDs (same origin + same ring)
        nodes: [makeFigureNode({ id: 'fnode-shared', originNodeId: FIGURE_NODE_ID })],
      };

      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockTemplateRepo.findOne.mockResolvedValue(nextTemplate);
      mockInstanceRepo.update.mockResolvedValue({});

      const result = await service.upgradeInstance(INSTANCE_ID);

      expect(mockInstanceNodeRepo.save).not.toHaveBeenCalled();
      expect(result.addedNodes).toBe(0);
      expect(result.updatedNodes).toBe(0);
      expect(result.totalNodes).toBe(1);
    });

    it('updates positions of existing nodes when the next variant has different coordinates', async () => {
      const existingINode = makeInstanceNode({
        id: 'inode-cordo',
        sourceNodeId: FIGURE_NODE_ID,
        originNodeId: null,
        x: 280,
        y: 56,
      });
      const instance = makeInstance({
        snapshotted: true,
        sourceVariantOrder: 1,
        figureTemplate: { id: TEMPLATE_ID, variantOrder: 1, family: { id: FAMILY_ID } },
        instanceNodes: [existingINode],
      });
      const nextTemplate = {
        id: NEXT_TEMPLATE_ID,
        name: 'Figure — variant 2',
        variantOrder: 2,
        family: { id: FAMILY_ID },
        nodes: [
          makeFigureNode({ id: 'fnode-moved', originNodeId: FIGURE_NODE_ID, x: 280, y: 8 }),
        ],
      };

      mockInstanceRepo.findOne.mockResolvedValue(instance);
      mockTemplateRepo.findOne.mockResolvedValue(nextTemplate);
      mockInstanceNodeRepo.update.mockResolvedValue({});
      mockInstanceRepo.update.mockResolvedValue({});

      const result = await service.upgradeInstance(INSTANCE_ID);

      expect(result.addedNodes).toBe(0);
      expect(result.updatedNodes).toBe(1);
      expect(mockInstanceNodeRepo.update).toHaveBeenCalledWith('inode-cordo', {
        x: 280, y: 8, width: 80, height: 40, rotation: 0,
      });
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
});
