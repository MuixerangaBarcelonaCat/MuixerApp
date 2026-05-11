import { Test, TestingModule } from '@nestjs/testing';
import { EventSegmentController } from './event-segment.controller';
import { EventSegmentService } from './event-segment.service';
import { FigureInstanceService } from './figure-instance.service';
import { SegmentWithInstances } from './event-segment.service';

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';
const INSTANCE_ID = 'instance-uuid-1';

const mockSegment: SegmentWithInstances = {
  id: SEGMENT_ID,
  name: null,
  sortOrder: 0,
  startTime: null,
  endTime: null,
  notes: null,
  isVisible: false,
  instances: [],
};

const mockInstance = {
  id: INSTANCE_ID,
  label: null,
  sortOrder: 0,
  figureTemplate: { id: 'fig-uuid', name: 'pd4' },
  compositionTemplate: null,
};

const mockSegmentService: Partial<EventSegmentService> = {
  findAllByEvent: jest.fn().mockResolvedValue([mockSegment]),
  create: jest.fn().mockResolvedValue(mockSegment),
  update: jest.fn().mockResolvedValue(mockSegment),
  remove: jest.fn().mockResolvedValue(undefined),
  reorder: jest.fn().mockResolvedValue(undefined),
};

const mockInstanceService: Partial<FigureInstanceService> = {
  create: jest.fn().mockResolvedValue(mockInstance),
  update: jest.fn().mockResolvedValue(mockInstance),
  remove: jest.fn().mockResolvedValue(undefined),
  reorder: jest.fn().mockResolvedValue(undefined),
};

describe('EventSegmentController', () => {
  let controller: EventSegmentController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventSegmentController],
      providers: [
        { provide: EventSegmentService, useValue: mockSegmentService },
        { provide: FigureInstanceService, useValue: mockInstanceService },
      ],
    }).compile();

    controller = module.get<EventSegmentController>(EventSegmentController);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('returns { data } envelope with segments', async () => {
      const result = await controller.findAll(EVENT_ID);
      expect(result).toEqual({ data: [mockSegment] });
      expect(mockSegmentService.findAllByEvent).toHaveBeenCalledWith(EVENT_ID);
    });
  });

  describe('create', () => {
    it('delegates to segment service and returns segment', async () => {
      const dto = { name: 'Bloc 1' };
      const result = await controller.create(EVENT_ID, dto);
      expect(result).toEqual(mockSegment);
      expect(mockSegmentService.create).toHaveBeenCalledWith(EVENT_ID, dto);
    });
  });

  describe('reorderSegments', () => {
    it('delegates reorder and returns void (204)', async () => {
      const dto = { segmentIds: [SEGMENT_ID] };
      await expect(controller.reorderSegments(EVENT_ID, dto)).resolves.toBeUndefined();
      expect(mockSegmentService.reorder).toHaveBeenCalledWith(EVENT_ID, dto);
    });
  });

  describe('updateSegment', () => {
    it('delegates to segment service with eventId and segmentId', async () => {
      const dto = { isVisible: true };
      const result = await controller.updateSegment(EVENT_ID, SEGMENT_ID, dto);
      expect(result).toEqual(mockSegment);
      expect(mockSegmentService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, dto);
    });
  });

  describe('removeSegment', () => {
    it('delegates to segment service and returns void (204)', async () => {
      await expect(controller.removeSegment(EVENT_ID, SEGMENT_ID)).resolves.toBeUndefined();
      expect(mockSegmentService.remove).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID);
    });
  });

  describe('createInstance', () => {
    it('delegates to instance service with eventId, segmentId and dto', async () => {
      const dto = { figureTemplateId: 'fig-uuid' };
      const result = await controller.createInstance(EVENT_ID, SEGMENT_ID, dto);
      expect(result).toEqual(mockInstance);
      expect(mockInstanceService.create).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, dto);
    });
  });

  describe('reorderInstances', () => {
    it('delegates reorder and returns void (204)', async () => {
      const dto = { instanceIds: [INSTANCE_ID] };
      await expect(controller.reorderInstances(EVENT_ID, SEGMENT_ID, dto)).resolves.toBeUndefined();
      expect(mockInstanceService.reorder).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, dto);
    });
  });

  describe('updateInstance', () => {
    it('delegates to instance service with full id chain', async () => {
      const dto = { label: 'Central' };
      const result = await controller.updateInstance(EVENT_ID, SEGMENT_ID, INSTANCE_ID, dto);
      expect(result).toEqual(mockInstance);
      expect(mockInstanceService.update).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INSTANCE_ID, dto);
    });
  });

  describe('removeInstance', () => {
    it('delegates to instance service and returns void (204)', async () => {
      await expect(controller.removeInstance(EVENT_ID, SEGMENT_ID, INSTANCE_ID)).resolves.toBeUndefined();
      expect(mockInstanceService.remove).toHaveBeenCalledWith(EVENT_ID, SEGMENT_ID, INSTANCE_ID);
    });
  });
});
