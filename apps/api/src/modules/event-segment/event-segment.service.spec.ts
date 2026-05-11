import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventSegmentService } from './event-segment.service';
import { EventSegment } from './entities/event-segment.entity';
import { Event } from '../event/event.entity';

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
      ],
    }).compile();

    service = module.get<EventSegmentService>(EventSegmentService);
    jest.clearAllMocks();
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
  });

  describe('remove', () => {
    it('removes the segment', async () => {
      const segment = makeSegment();
      mockSegmentRepo.findOne.mockResolvedValue(segment);
      mockSegmentRepo.remove.mockResolvedValue(undefined);

      await service.remove(EVENT_ID, SEGMENT_ID);

      expect(mockSegmentRepo.remove).toHaveBeenCalledWith(segment);
    });

    it('throws 404 if segment does not belong to event', async () => {
      mockSegmentRepo.findOne.mockResolvedValue(null);

      await expect(service.remove(EVENT_ID, SEGMENT_ID)).rejects.toThrow(NotFoundException);
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
  });
});
