import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventSegmentService } from './event-segment.service';
import { EventSegment } from './entities/event-segment.entity';
import { Event } from '../event/event.entity';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';

const EVENT_ID = 'event-uuid-1';
const SEGMENT_ID = 'segment-uuid-1';

const makeEvent = (): Event => ({ id: EVENT_ID } as Event);

const makeSegment = (overrides: Partial<EventSegment> = {}): EventSegment =>
  ({
    id: SEGMENT_ID,
    event: makeEvent(),
    name: null,
    sortOrder: 0,
    startTime: null,
    endTime: null,
    notes: null,
    isVisible: false,
    instances: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }) as EventSegment;

const mockSegmentQb = {
  leftJoinAndSelect: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  getRawOne: jest.fn().mockResolvedValue({ max: null }),
  getMany: jest.fn().mockResolvedValue([makeSegment()]),
  getOne: jest.fn().mockResolvedValue(makeSegment()),
};

const mockSegmentRepo = {
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
  createQueryBuilder: jest.fn().mockReturnValue(mockSegmentQb),
};

const mockEventRepo = {
  findOne: jest.fn(),
};

const mockDataSource = {
  transaction: jest.fn().mockImplementation((cb) => cb({ update: jest.fn() })),
  query: jest.fn().mockResolvedValue([]),
};

const DEFAULT_CONFLICTS_META = {
  assignmentCount: 0,
  distinctPersonCount: 0,
  tronc: { distinctPersonCount: 0 },
  pinya: { distinctPersonCount: 0 },
  conflictPersonCount: 0,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
};

const mockNodeAssignmentService = {
  checkEventLockByEventId: jest.fn(),
  getSegmentConflicts: jest.fn(),
};

describe('EventSegmentService', () => {
  let service: EventSegmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventSegmentService,
        { provide: getRepositoryToken(EventSegment), useValue: mockSegmentRepo },
        { provide: getRepositoryToken(Event), useValue: mockEventRepo },
        { provide: DataSource, useValue: mockDataSource },
        { provide: NodeAssignmentService, useValue: mockNodeAssignmentService },
      ],
    }).compile();

    service = module.get<EventSegmentService>(EventSegmentService);
    jest.clearAllMocks();
    mockNodeAssignmentService.checkEventLockByEventId.mockResolvedValue(undefined);
    mockNodeAssignmentService.getSegmentConflicts.mockResolvedValue({ data: [], meta: DEFAULT_CONFLICTS_META });
    mockSegmentRepo.createQueryBuilder.mockReturnValue(mockSegmentQb);
    mockSegmentQb.leftJoinAndSelect.mockReturnThis();
    mockSegmentQb.where.mockReturnThis();
    mockSegmentQb.orderBy.mockReturnThis();
    mockSegmentQb.addOrderBy.mockReturnThis();
    mockSegmentQb.select.mockReturnThis();
    mockSegmentQb.getRawOne.mockResolvedValue({ max: null });
    mockSegmentQb.getMany.mockResolvedValue([makeSegment()]);
    mockSegmentQb.getOne.mockResolvedValue(makeSegment());
  });

  describe('findAllByEvent', () => {
    it('returns segments for the event', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(SEGMENT_ID);
    });

    it('throws 404 if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.findAllByEvent(EVENT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a segment with sortOrder = max+1', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getRawOne.mockResolvedValue({ max: 2 });
      mockSegmentRepo.create.mockReturnValue(makeSegment({ sortOrder: 3 }));
      mockSegmentRepo.save.mockResolvedValue(makeSegment({ sortOrder: 3 }));

      const result = await service.create(EVENT_ID, { name: 'Bloc' });

      expect(mockSegmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 3 }),
      );
      expect(result.sortOrder).toBe(0);
    });

    it('assigns sortOrder 0 when no existing segments', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getRawOne.mockResolvedValue({ max: null });
      mockSegmentRepo.create.mockReturnValue(makeSegment({ sortOrder: 0 }));
      mockSegmentRepo.save.mockResolvedValue(makeSegment());

      await service.create(EVENT_ID, {});

      expect(mockSegmentRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ sortOrder: 0 }),
      );
    });

    it('throws 404 if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.create(EVENT_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException and does not create when event is locked', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockNodeAssignmentService.checkEventLockByEventId.mockRejectedValue(new ForbiddenException('locked'));

      await expect(service.create(EVENT_ID, { name: 'Bloc' })).rejects.toThrow(ForbiddenException);

      expect(mockNodeAssignmentService.checkEventLockByEventId).toHaveBeenCalledWith(EVENT_ID);
      expect(mockSegmentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('updates segment fields and returns updated segment', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockSegmentRepo.save.mockResolvedValue(makeSegment());

      const result = await service.update(EVENT_ID, SEGMENT_ID, { isVisible: true, name: 'Bloc 1' });

      expect(mockSegmentRepo.save).toHaveBeenCalled();
      expect(result.id).toBe(SEGMENT_ID);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(service.update(EVENT_ID, SEGMENT_ID, {})).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException and does not rename when event is locked', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockNodeAssignmentService.checkEventLockByEventId.mockRejectedValue(new ForbiddenException('locked'));

      await expect(
        service.update(EVENT_ID, SEGMENT_ID, { name: 'Nou nom' }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockNodeAssignmentService.checkEventLockByEventId).toHaveBeenCalledWith(EVENT_ID);
      expect(mockSegmentRepo.save).not.toHaveBeenCalled();
    });

    it('does not check the lock when only isVisible is changing', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockSegmentRepo.save.mockResolvedValue(makeSegment());

      await service.update(EVENT_ID, SEGMENT_ID, { isVisible: true });

      expect(mockNodeAssignmentService.checkEventLockByEventId).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('removes the segment', async () => {
      const segment = makeSegment();
      mockSegmentRepo.findOne.mockResolvedValue(segment);
      mockSegmentRepo.remove.mockResolvedValue(undefined);

      await service.remove(EVENT_ID, SEGMENT_ID);

      expect(mockNodeAssignmentService.checkEventLockByEventId).toHaveBeenCalledWith(EVENT_ID);
      expect(mockSegmentRepo.remove).toHaveBeenCalledWith(segment);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(EVENT_ID, SEGMENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException and does not remove when event is locked', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(makeSegment());
      mockNodeAssignmentService.checkEventLockByEventId.mockRejectedValue(new ForbiddenException('locked'));

      await expect(service.remove(EVENT_ID, SEGMENT_ID)).rejects.toThrow(ForbiddenException);
      expect(mockSegmentRepo.remove).not.toHaveBeenCalled();
    });
  });

  describe('findAllByEvent — totalCordons', () => {
    it('includes totalCordons for instances with pinya', async () => {
      const figTemplate = { id: 'fig-uuid-1', name: 'pd4' } as any;
      const instance = { id: 'inst-uuid-1', snapshotted: false, figureTemplate: figTemplate, compositionTemplate: null, figureMode: 'COMPLETA', label: null, sortOrder: 0, numberOfCordons: null } as any;
      const seg = makeSegment({ instances: [instance] });

      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getMany.mockResolvedValue([seg]);
      mockDataSource.query
        .mockResolvedValueOnce([])               // loadAssignmentCounts
        .mockResolvedValueOnce([])               // loadPinyaAssignmentCounts
        .mockResolvedValueOnce([{ templateId: 'fig-uuid-1' }])  // loadPinyaTemplateIds
        .mockResolvedValueOnce([{ templateId: 'fig-uuid-1', total: '4' }]);        // loadTotalCordons

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result[0].instances[0].totalCordons).toBe(4);
    });

    it('includes cordonsObertsEnabled from the instance', async () => {
      const figTemplate = { id: 'fig-uuid-1', name: 'pd4' } as any;
      const instance = {
        id: 'inst-uuid-1',
        snapshotted: false,
        figureTemplate: figTemplate,
        compositionTemplate: null,
        figureMode: 'COMPLETA',
        label: null,
        sortOrder: 0,
        numberOfCordons: null,
        cordonsObertsEnabled: false,
      } as any;
      const seg = makeSegment({ instances: [instance] });

      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getMany.mockResolvedValue([seg]);
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ templateId: 'fig-uuid-1' }])
        .mockResolvedValueOnce([{ templateId: 'fig-uuid-1', total: '4' }]);

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result[0].instances[0].cordonsObertsEnabled).toBe(false);
    });

    it('returns null totalCordons for REMAT instances', async () => {
      const figTemplate = { id: 'fig-uuid-1', name: 'pd4' } as any;
      const instance = { id: 'inst-uuid-1', snapshotted: false, figureTemplate: figTemplate, compositionTemplate: null, figureMode: 'REMAT', label: null, sortOrder: 0, numberOfCordons: null } as any;
      const seg = makeSegment({ instances: [instance] });

      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getMany.mockResolvedValue([seg]);
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ templateId: 'fig-uuid-1' }])
        .mockResolvedValueOnce([]);

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result[0].instances[0].totalCordons).toBeNull();
    });
  });

  describe('findAllByEvent — conflicts', () => {
    it('includes the segment conflict counters sourced from getSegmentConflicts (D13)', async () => {
      const meta = {
        assignmentCount: 3,
        distinctPersonCount: 3,
        tronc: { distinctPersonCount: 1 },
        pinya: { distinctPersonCount: 2 },
        conflictPersonCount: 0,
        conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
      };
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getMany.mockResolvedValue([makeSegment()]);
      mockNodeAssignmentService.getSegmentConflicts.mockResolvedValue({ data: [], meta });

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result[0].conflicts).toEqual(meta);
      expect(mockNodeAssignmentService.getSegmentConflicts).toHaveBeenCalledWith(SEGMENT_ID);
    });

    it('defaults conflict counters to zero/empty in production (no duplicates yet)', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentQb.getMany.mockResolvedValue([makeSegment()]);

      const result = await service.findAllByEvent(EVENT_ID);

      expect(result[0].conflicts).toEqual(DEFAULT_CONFLICTS_META);
    });
  });

  describe('getTroncView', () => {
    it('throws 404 if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.getTroncView(EVENT_ID)).rejects.toThrow(NotFoundException);
    });

    it('returns empty array when no snapshotted instances', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockDataSource.query.mockResolvedValueOnce([]);

      const result = await service.getTroncView(EVENT_ID);

      expect(result).toEqual([]);
    });

    it('builds floor structure from node rows', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockDataSource.query.mockResolvedValueOnce([
        { instance_id: 'inst-1', zone: 'BASE', z: 0, sort_order: 0, alias: 'Pepet' },
        { instance_id: 'inst-1', zone: 'BASE', z: 0, sort_order: 1, alias: null },
        { instance_id: 'inst-1', zone: 'TRONC', z: 1, sort_order: 0, alias: 'Maria' },
        { instance_id: 'inst-1', zone: 'TRONC', z: 2, sort_order: 0, alias: null },
      ]);

      const result = await service.getTroncView(EVENT_ID);

      expect(result).toHaveLength(1);
      expect(result[0].instanceId).toBe('inst-1');
      const floors = result[0].floors;
      const baseFloor = floors.find((f) => f.isBase);
      const troncFloor1 = floors.find((f) => !f.isBase && f.z === 1);
      expect(baseFloor?.slots).toEqual(['Pepet', null]);
      expect(troncFloor1?.slots).toEqual(['Maria']);
    });
  });

  describe('reorder', () => {
    it('reassigns sortOrder via transaction', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentRepo.find.mockResolvedValue([makeSegment()]);

      await service.reorder(EVENT_ID, { segmentIds: [SEGMENT_ID] });

      expect(mockDataSource.transaction).toHaveBeenCalled();
    });

    it('throws 400 if segment IDs do not match event segments', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentRepo.find.mockResolvedValue([makeSegment()]);

      await expect(
        service.reorder(EVENT_ID, { segmentIds: ['non-existent-uuid'] }),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws 404 if event does not exist', async () => {
      mockEventRepo.findOne.mockResolvedValue(null);

      await expect(service.reorder(EVENT_ID, { segmentIds: [] })).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException and does not reorder when event is locked', async () => {
      mockEventRepo.findOne.mockResolvedValue(makeEvent());
      mockSegmentRepo.find.mockResolvedValue([makeSegment()]);
      mockNodeAssignmentService.checkEventLockByEventId.mockRejectedValue(new ForbiddenException('locked'));

      await expect(
        service.reorder(EVENT_ID, { segmentIds: [SEGMENT_ID] }),
      ).rejects.toThrow(ForbiddenException);

      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });
  });
});
