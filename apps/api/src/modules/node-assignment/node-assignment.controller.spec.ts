import { Test, TestingModule } from '@nestjs/testing';
import { NodeAssignmentController } from './node-assignment.controller';
import { NodeAssignmentService } from './node-assignment.service';
import { AvailablePersonsService } from './available-persons.service';

const INSTANCE_ID = 'instance-uuid-1';
const ASSIGNMENT_ID = 'assignment-uuid-1';
const TEMPLATE_ID = 'template-uuid-1';
const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

const mockAssignment = {
  id: ASSIGNMENT_ID,
  figureInstanceId: INSTANCE_ID,
  compositionSlotId: null,
  node: { id: 'node-uuid-1', label: 'pd4-1', zone: 'TRONC', z: 1, positionType: 'pd4', sortOrder: 0 },
  person: { id: 'person-uuid-1', alias: 'Pepet', name: 'Pere', firstSurname: 'Garcia', shoulderHeight: 140 },
};

const mockAvailablePerson = {
  id: 'person-uuid-1',
  alias: 'Pepet',
  name: 'Pere',
  firstSurname: 'Garcia',
  shoulderHeight: 140,
  isXicalla: false,
  attendanceStatus: 'CONFIRMED',
  nextPerformanceStatus: null,
  assignedInSegment: false,
};

const mockHistoryEntry = {
  eventId: EVENT_ID,
  eventTitle: 'Assaig Setmana Santa',
  eventDate: '2026-03-01',
  segmentName: 'Bloc 1',
  instanceId: INSTANCE_ID,
  assignmentCount: 8,
  totalNodes: 10,
  assignments: [],
};

const mockAssignmentService: Partial<NodeAssignmentService> = {
  getByInstance: jest.fn().mockResolvedValue([mockAssignment]),
  assign: jest.fn().mockResolvedValue(mockAssignment),
  unassign: jest.fn().mockResolvedValue(undefined),
  bulkImport: jest.fn().mockResolvedValue({ created: [mockAssignment], conflicts: [] }),
  getHistory: jest.fn().mockResolvedValue([mockHistoryEntry]),
};

const mockAvailablePersonsService: Partial<AvailablePersonsService> = {
  getAvailablePersons: jest.fn().mockResolvedValue([mockAvailablePerson]),
  getNextPerformance: jest.fn().mockResolvedValue(null),
};

describe('NodeAssignmentController', () => {
  let controller: NodeAssignmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NodeAssignmentController],
      providers: [
        { provide: NodeAssignmentService, useValue: mockAssignmentService },
        { provide: AvailablePersonsService, useValue: mockAvailablePersonsService },
      ],
    }).compile();

    controller = module.get<NodeAssignmentController>(NodeAssignmentController);
    jest.clearAllMocks();
  });

  describe('getByInstance', () => {
    it('delegates to service and returns { data } envelope', async () => {
      (mockAssignmentService.getByInstance as jest.Mock).mockResolvedValue([mockAssignment]);

      const result = await controller.getByInstance(INSTANCE_ID);

      expect(result).toEqual({ data: [mockAssignment] });
      expect(mockAssignmentService.getByInstance).toHaveBeenCalledWith(INSTANCE_ID);
    });
  });

  describe('assign', () => {
    it('delegates to service and returns created assignment', async () => {
      (mockAssignmentService.assign as jest.Mock).mockResolvedValue(mockAssignment);
      const dto = { nodeId: 'node-uuid-1', personId: 'person-uuid-1' };

      const result = await controller.assign(INSTANCE_ID, dto as any);

      expect(result).toEqual(mockAssignment);
      expect(mockAssignmentService.assign).toHaveBeenCalledWith(INSTANCE_ID, dto);
    });
  });

  describe('unassign', () => {
    it('delegates to service and returns void (204)', async () => {
      (mockAssignmentService.unassign as jest.Mock).mockResolvedValue(undefined);

      await expect(controller.unassign(INSTANCE_ID, ASSIGNMENT_ID)).resolves.toBeUndefined();
      expect(mockAssignmentService.unassign).toHaveBeenCalledWith(INSTANCE_ID, ASSIGNMENT_ID);
    });
  });

  describe('bulkImport', () => {
    it('delegates to service and returns bulk import result', async () => {
      const expected = { created: [mockAssignment], conflicts: [] };
      (mockAssignmentService.bulkImport as jest.Mock).mockResolvedValue(expected);
      const dto = { sourceInstanceId: 'source-uuid' };

      const result = await controller.bulkImport(INSTANCE_ID, dto as any);

      expect(result).toEqual(expected);
      expect(mockAssignmentService.bulkImport).toHaveBeenCalledWith(INSTANCE_ID, dto);
    });
  });

  describe('getAvailablePersons', () => {
    it('delegates to AvailablePersonsService and returns { data } envelope', async () => {
      (mockAvailablePersonsService.getAvailablePersons as jest.Mock).mockResolvedValue([mockAvailablePerson]);
      const query = { search: 'pere' };

      const result = await controller.getAvailablePersons(EVENT_ID, SEGMENT_ID, query as any);

      expect(result).toEqual({ data: [mockAvailablePerson] });
      expect(mockAvailablePersonsService.getAvailablePersons).toHaveBeenCalledWith(
        EVENT_ID,
        SEGMENT_ID,
        query,
      );
    });
  });

  describe('getHistory', () => {
    it('delegates to service and returns { data } envelope', async () => {
      (mockAssignmentService.getHistory as jest.Mock).mockResolvedValue([mockHistoryEntry]);

      const result = await controller.getHistory(TEMPLATE_ID);

      expect(result).toEqual({ data: [mockHistoryEntry] });
      expect(mockAssignmentService.getHistory).toHaveBeenCalledWith(TEMPLATE_ID);
    });
  });

  describe('getNextPerformance', () => {
    it('delegates to AvailablePersonsService and returns next performance event', async () => {
      (mockAvailablePersonsService.getNextPerformance as jest.Mock).mockResolvedValue(null);

      const result = await controller.getNextPerformance(EVENT_ID);

      expect(result).toBeNull();
      expect(mockAvailablePersonsService.getNextPerformance).toHaveBeenCalledWith(EVENT_ID);
    });
  });
});
