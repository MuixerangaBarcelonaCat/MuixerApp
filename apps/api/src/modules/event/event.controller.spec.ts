import { Test, TestingModule } from '@nestjs/testing';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { EventType, AttendanceStatus } from '@muixer/shared';

describe('EventController', () => {
  let controller: EventController;
  let eventService: jest.Mocked<EventService>;
  let attendanceService: jest.Mocked<AttendanceService>;

  beforeEach(async () => {
    eventService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn(),
      update: jest.fn(),
    } as unknown as jest.Mocked<EventService>;

    attendanceService = {
      findByEvent: jest.fn().mockResolvedValue({ data: [], total: 0 }),
    } as unknown as jest.Mocked<AttendanceService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EventController],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: AttendanceService, useValue: attendanceService },
      ],
    }).compile();

    controller = module.get<EventController>(EventController);
  });

  describe('findAll', () => {
    it('returns { data, meta } envelope', async () => {
      const result = await controller.findAll({ page: 1, limit: 25 });
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta.total).toBe(0);
    });

    it('passes filters to service', async () => {
      await controller.findAll({ eventType: EventType.ASSAIG, seasonId: 's1', page: 1, limit: 25 });
      expect(eventService.findAll).toHaveBeenCalledWith({ eventType: EventType.ASSAIG, seasonId: 's1', page: 1, limit: 25 });
    });
  });

  describe('findAttendance', () => {
    it('returns paginated attendance with default limit 100', async () => {
      const result = await controller.findAttendance('ev-uuid', {});
      expect(result.meta.limit).toBe(100);
    });

    it('delegates to attendanceService.findByEvent', async () => {
      await controller.findAttendance('ev-uuid', { status: AttendanceStatus.ASSISTIT });
      expect(attendanceService.findByEvent).toHaveBeenCalledWith('ev-uuid', { status: AttendanceStatus.ASSISTIT });
    });
  });

  describe('update', () => {
    it('delegates to eventService.update', async () => {
      eventService.update.mockResolvedValue({ id: 'ev-uuid', countsForStatistics: false } as never);
      await controller.update('ev-uuid', { countsForStatistics: false });
      expect(eventService.update).toHaveBeenCalledWith('ev-uuid', { countsForStatistics: false });
    });
  });
});
