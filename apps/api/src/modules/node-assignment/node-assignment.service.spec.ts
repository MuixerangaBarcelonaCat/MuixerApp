import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { NodeAssignmentService } from './node-assignment.service';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureZone, NodeShape } from '@muixer/shared';

// ─── Test fixtures ──────────────────────────────────────────────────────────

const TEMPLATE_ID = 'template-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const NODE_ID = 'node-uuid-1';
const PERSON_ID = 'person-uuid-1';
const ASSIGNMENT_ID = 'assignment-uuid-1';
const SLOT_ID = 'slot-uuid-1';
const COMP_TEMPLATE_ID = 'comp-template-uuid-1';

const makePerson = (id = PERSON_ID) => ({
  id,
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
});

const makeNode = (id = NODE_ID, templateId = TEMPLATE_ID) => ({
  id,
  label: 'pd4-1',
  zone: FigureZone.TRONC,
  z: 1,
  positionType: 'pd4',
  sortOrder: 0,
  template: { id: templateId },
});

const makeSegment = (id = SEGMENT_ID) => ({
  id,
  name: 'Assaig bloc 1',
  event: { id: 'event-uuid-1', title: 'Assaig', date: '2026-05-01' },
});

const makeInstance = (
  id = INSTANCE_ID,
  overrides: Partial<{
    figureTemplate: any;
    compositionTemplate: any;
    segment: any;
    assignments: any[];
  }> = {},
) => ({
  id,
  figureTemplate: { id: TEMPLATE_ID, nodes: [makeNode()] },
  compositionTemplate: null,
  segment: makeSegment(),
  assignments: [],
  createdAt: new Date(),
  ...overrides,
});

const makeAssignment = (id = ASSIGNMENT_ID) => ({
  id,
  figureInstance: makeInstance(),
  figureNode: makeNode(),
  person: makePerson(),
  compositionSlot: null,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─── Mock query builder ──────────────────────────────────────────────────────

const mockQb = {
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  getOne: jest.fn().mockResolvedValue(null),
};

// ─── Mock repositories ───────────────────────────────────────────────────────

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
};

const mockNodeRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
};

const mockPersonRepo = {
  findOne: jest.fn(),
};

const mockSlotRepo = {
  findOne: jest.fn(),
};

const mockTemplateRepo = {
  findOne: jest.fn(),
};

const mockSegmentRepo = {
  findOne: jest.fn(),
};

// ─── Suite setup ─────────────────────────────────────────────────────────────

describe('NodeAssignmentService', () => {
  let service: NodeAssignmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NodeAssignmentService,
        { provide: getRepositoryToken(NodeAssignment), useValue: mockAssignmentRepo },
        { provide: getRepositoryToken(FigureInstance), useValue: mockInstanceRepo },
        { provide: getRepositoryToken(FigureNode), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Person), useValue: mockPersonRepo },
        { provide: getRepositoryToken(CompositionSlot), useValue: mockSlotRepo },
        { provide: getRepositoryToken(FigureTemplate), useValue: mockTemplateRepo },
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
      ],
    }).compile();

    service = module.get<NodeAssignmentService>(NodeAssignmentService);
    jest.clearAllMocks();
    mockAssignmentRepo.createQueryBuilder.mockReturnValue(mockQb);
    mockQb.innerJoin.mockReturnThis();
    mockQb.where.mockReturnThis();
    mockQb.andWhere.mockReturnThis();
    mockQb.getOne.mockResolvedValue(null);
  });

  // ── getByInstance ──────────────────────────────────────────────────────────

  describe('getByInstance', () => {
    it('returns assignments with person and node data populated', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      const a = makeAssignment();
      mockAssignmentRepo.find.mockResolvedValue([a]);

      const result = await service.getByInstance(INSTANCE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(ASSIGNMENT_ID);
      expect(result[0].node.id).toBe(NODE_ID);
      expect(result[0].person.id).toBe(PERSON_ID);
    });

    it('returns empty array for instance with no assignments', async () => {
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

  // ── assign ─────────────────────────────────────────────────────────────────

  describe('assign', () => {
    it('assigns person to empty node (success, standalone figure)', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      mockAssignmentRepo.findOne.mockResolvedValue(null);
      const a = makeAssignment();
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);
      mockAssignmentRepo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(null).mockResolvedValue(a);

      const result = await service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID });

      expect(result.id).toBe(ASSIGNMENT_ID);
      expect(mockAssignmentRepo.save).toHaveBeenCalled();
    });

    it('assigns person to empty node (success, composition with slotId)', async () => {
      const slot = { id: SLOT_ID, figureTemplate: { id: TEMPLATE_ID }, composition: { id: COMP_TEMPLATE_ID } };
      mockInstanceRepo.findOne.mockResolvedValue(
        makeInstance(INSTANCE_ID, { figureTemplate: null, compositionTemplate: { id: COMP_TEMPLATE_ID } }),
      );
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      mockSlotRepo.findOne.mockResolvedValue(slot);
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue(makeAssignment());
      const a = makeAssignment();
      mockAssignmentRepo.create.mockReturnValue(a);
      mockAssignmentRepo.save.mockResolvedValue(a);

      const result = await service.assign(INSTANCE_ID, {
        nodeId: NODE_ID,
        personId: PERSON_ID,
        compositionSlotId: SLOT_ID,
      });

      expect(result.id).toBe(ASSIGNMENT_ID);
    });

    it('throws NotFoundException if figureInstance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if person not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(null);

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if compositionSlotId missing for composition instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(
        makeInstance(INSTANCE_ID, { figureTemplate: null, compositionTemplate: { id: COMP_TEMPLATE_ID } }),
      );
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException if compositionSlotId provided for standalone instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID, compositionSlotId: SLOT_ID }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws ConflictException if node already occupied', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      // First findOne (node conflict check) returns occupied
      mockAssignmentRepo.findOne.mockResolvedValueOnce(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if person already in same instance', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      // First findOne (node check) returns null, second (person check) returns occupied
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ConflictException if person already assigned in another instance of same segment', async () => {
      mockInstanceRepo.findOne.mockResolvedValue(makeInstance());
      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      mockAssignmentRepo.findOne.mockResolvedValue(null);
      // Segment conflict query builder returns an assignment
      mockQb.getOne.mockResolvedValue(makeAssignment());

      await expect(
        service.assign(INSTANCE_ID, { nodeId: NODE_ID, personId: PERSON_ID }),
      ).rejects.toThrow(ConflictException);
    });
  });

  // ── unassign ───────────────────────────────────────────────────────────────

  describe('unassign', () => {
    it('removes assignment successfully', async () => {
      const a = makeAssignment();
      mockAssignmentRepo.findOne.mockResolvedValue(a);
      mockAssignmentRepo.remove.mockResolvedValue(a);

      await expect(service.unassign(INSTANCE_ID, ASSIGNMENT_ID)).resolves.toBeUndefined();
      expect(mockAssignmentRepo.remove).toHaveBeenCalledWith(a);
    });

    it('throws NotFoundException if assignment not found', async () => {
      mockAssignmentRepo.findOne.mockResolvedValue(null);

      await expect(service.unassign(INSTANCE_ID, ASSIGNMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if assignment does not belong to instanceId', async () => {
      const a = makeAssignment();
      a.figureInstance = makeInstance('other-instance-id') as any;
      mockAssignmentRepo.findOne.mockResolvedValue(a);

      await expect(service.unassign(INSTANCE_ID, ASSIGNMENT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns events with assignments for the template, ordered by date DESC', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ id: TEMPLATE_ID, name: 'pd4' });
      const instance = makeInstance();
      (instance as any).assignments = [makeAssignment()];
      mockInstanceRepo.find.mockResolvedValue([instance]);

      const result = await service.getHistory(TEMPLATE_ID);

      expect(result).toHaveLength(1);
      expect(result[0].instanceId).toBe(INSTANCE_ID);
      expect(result[0].assignments).toHaveLength(1);
    });

    it('returns empty array when template has no instances', async () => {
      mockTemplateRepo.findOne.mockResolvedValue({ id: TEMPLATE_ID, name: 'pd4' });
      mockInstanceRepo.find.mockResolvedValue([]);

      const result = await service.getHistory(TEMPLATE_ID);

      expect(result).toEqual([]);
    });

    it('throws NotFoundException if template not found', async () => {
      mockTemplateRepo.findOne.mockResolvedValue(null);

      await expect(service.getHistory(TEMPLATE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── bulkImport ─────────────────────────────────────────────────────────────

  describe('bulkImport', () => {
    it('copies all assignments from source to target (success)', async () => {
      const targetInstance = makeInstance(INSTANCE_ID);
      const sourceInstance = makeInstance('source-uuid');
      const sourceAssignment = makeAssignment();

      // bulkImport calls: target instance, source instance, then assign() calls it again
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(targetInstance) // bulkImport: target
        .mockResolvedValueOnce(sourceInstance) // bulkImport: source
        .mockResolvedValue(targetInstance); // assign: instance lookup

      mockAssignmentRepo.find.mockResolvedValue([sourceAssignment]);
      mockNodeRepo.find.mockResolvedValue([makeNode()]); // bulkImport: target nodes
      mockNodeRepo.findOne.mockResolvedValue(makeNode()); // assign: node lookup
      mockPersonRepo.findOne.mockResolvedValue(makePerson()); // assign: person lookup

      // bulkImport checks: node not occupied, person not in instance
      // assign checks: node not occupied, person not in instance
      // assign: final populated findOne
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null) // bulkImport: node not occupied
        .mockResolvedValueOnce(null) // bulkImport: person not in instance
        .mockResolvedValueOnce(null) // assign: node conflict
        .mockResolvedValueOnce(null) // assign: person conflict
        .mockResolvedValue(makeAssignment()); // assign: reload populated

      mockAssignmentRepo.create.mockReturnValue(makeAssignment());
      mockAssignmentRepo.save.mockResolvedValue(makeAssignment());

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.created).toHaveLength(1);
      expect(result.conflicts).toHaveLength(0);
    });

    it('skips nodes that no longer exist in current template', async () => {
      const targetInstance = makeInstance(INSTANCE_ID);
      const sourceInstance = makeInstance('source-uuid');
      // Source has node with a different ID not in target template
      const sourceAssignment = { ...makeAssignment(), figureNode: { ...makeNode(), id: 'old-node-uuid' } };

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(targetInstance)
        .mockResolvedValueOnce(sourceInstance);
      mockAssignmentRepo.find.mockResolvedValue([sourceAssignment]);
      mockNodeRepo.find.mockResolvedValue([makeNode()]); // target nodes: only NODE_ID

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.created).toHaveLength(0);
      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toMatch(/no longer exists/i);
    });

    it('skips nodes already occupied in target instance', async () => {
      const targetInstance = makeInstance(INSTANCE_ID);
      const sourceInstance = makeInstance('source-uuid');

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(targetInstance)
        .mockResolvedValueOnce(sourceInstance);
      mockAssignmentRepo.find.mockResolvedValue([makeAssignment()]);
      mockNodeRepo.find.mockResolvedValue([makeNode()]);
      // Node already occupied check returns a result
      mockAssignmentRepo.findOne.mockResolvedValueOnce(makeAssignment());

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toMatch(/already occupied/i);
    });

    it('skips persons already assigned in target segment', async () => {
      const targetInstance = makeInstance(INSTANCE_ID);
      const sourceInstance = makeInstance('source-uuid');

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(targetInstance)
        .mockResolvedValueOnce(sourceInstance);
      mockAssignmentRepo.find.mockResolvedValue([makeAssignment()]);
      mockNodeRepo.find.mockResolvedValue([makeNode()]);
      // node check: not occupied, person in instance: not occupied → proceed to segment check
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null) // node not occupied
        .mockResolvedValueOnce(null); // person not in instance
      // Segment check returns existing assignment → conflict
      mockQb.getOne.mockResolvedValueOnce(makeAssignment());

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.conflicts).toHaveLength(1);
      expect(result.conflicts[0].reason).toMatch(/already assigned in this segment/i);
    });

    it('returns partial result with created and conflicts', async () => {
      const targetInstance = makeInstance(INSTANCE_ID);
      const sourceInstance = makeInstance('source-uuid');
      const node2 = makeNode('node-uuid-2');
      const assignment2 = { ...makeAssignment('assignment-uuid-2'), figureNode: node2 };

      mockInstanceRepo.findOne
        .mockResolvedValueOnce(targetInstance)
        .mockResolvedValueOnce(sourceInstance);
      mockAssignmentRepo.find.mockResolvedValue([makeAssignment(), assignment2]);
      mockNodeRepo.find.mockResolvedValue([makeNode(), node2]);
      // Assignment 1: success. Assignment 2: node already occupied.
      mockAssignmentRepo.findOne
        .mockResolvedValueOnce(null) // node 1 not occupied
        .mockResolvedValueOnce(null) // person 1 not in instance
        .mockResolvedValueOnce(makeAssignment()) // node 2 occupied
        .mockResolvedValue(makeAssignment()); // assign sub-call

      mockPersonRepo.findOne.mockResolvedValue(makePerson());
      mockNodeRepo.findOne.mockResolvedValue(makeNode());
      mockAssignmentRepo.create.mockReturnValue(makeAssignment());
      mockAssignmentRepo.save.mockResolvedValue(makeAssignment());

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
    });

    it('handles empty source (no assignments to import)', async () => {
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance(INSTANCE_ID))
        .mockResolvedValueOnce(makeInstance('source-uuid'));
      mockAssignmentRepo.find.mockResolvedValue([]);
      mockNodeRepo.find.mockResolvedValue([makeNode()]);

      const result = await service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' });

      expect(result.created).toHaveLength(0);
      expect(result.conflicts).toHaveLength(0);
    });

    it('throws NotFoundException if target instance not found', async () => {
      mockInstanceRepo.findOne.mockResolvedValueOnce(null);

      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if source instance not found', async () => {
      mockInstanceRepo.findOne
        .mockResolvedValueOnce(makeInstance(INSTANCE_ID))
        .mockResolvedValueOnce(null);

      await expect(
        service.bulkImport(INSTANCE_ID, { sourceInstanceId: 'source-uuid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── countByNode ────────────────────────────────────────────────────────────

  describe('countByNode', () => {
    it('returns count of assignments for a node', async () => {
      mockAssignmentRepo.count.mockResolvedValue(3);

      const count = await service.countByNode(NODE_ID);

      expect(count).toBe(3);
      expect(mockAssignmentRepo.count).toHaveBeenCalledWith({ where: { figureNode: { id: NODE_ID } } });
    });

    it('returns 0 when node has no assignments', async () => {
      mockAssignmentRepo.count.mockResolvedValue(0);

      const count = await service.countByNode(NODE_ID);

      expect(count).toBe(0);
    });
  });
});
