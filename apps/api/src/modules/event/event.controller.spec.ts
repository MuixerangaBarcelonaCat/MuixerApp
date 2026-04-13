import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { EventType, AttendanceStatus } from '@muixer/shared';

const mockEventDetail = {
  id: 'ev-uuid',
  title: 'Assaig de prova',
  eventType: EventType.ASSAIG,
  date: new Date('2026-05-10'),
  startTime: '19:00',
  location: null,
  locationUrl: null,
  countsForStatistics: true,
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, noShow: 0, lateCancel: 0, children: 0, total: 0 },
  season: null,
  createdAt: new Date(),
  description: null,
  information: null,
  metadata: {},
  isSynced: false,
};

const mockAttendanceResponse = {
  attendance: { id: 'att-uuid', status: AttendanceStatus.ANIRE, respondedAt: new Date(), notes: null, person: { id: 'p1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isXicalla: false, positions: [] } },
  summary: { confirmed: 1, declined: 0, pending: 0, attended: 0, noShow: 0, lateCancel: 0, children: 0, total: 1 },
};

describe('EventController', () => {
  let controller: EventController;
  let eventService: jest.Mocked<EventService>;
  let attendanceService: jest.Mocked<AttendanceService>;

  beforeEach(async () => {
    eventService = {
      findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      findOne: jest.fn().mockResolvedValue(mockEventDetail),
      create: jest.fn().mockResolvedValue(mockEventDetail),
      update: jest.fn().mockResolvedValue(mockEventDetail),
      remove: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventService>;

    attendanceService = {
      findByEvent: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      create: jest.fn().mockResolvedValue(mockAttendanceResponse),
      update: jest.fn().mockResolvedValue(mockAttendanceResponse),
      remove: jest.fn().mockResolvedValue({ summary: mockAttendanceResponse.summary }),
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

  // --- findAll ---
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

  // --- create ---
  describe('create', () => {
    it('delegates to eventService.create and returns detail', async () => {
      const dto = { title: 'Assaig de prova', eventType: EventType.ASSAIG, date: '2026-05-10' };
      const result = await controller.create(dto);
      expect(eventService.create).toHaveBeenCalledWith(dto);
      expect(result.id).toBe('ev-uuid');
    });

    it('propagates NotFoundException from service when seasonId invalid', async () => {
      eventService.create.mockRejectedValueOnce(new NotFoundException('Season not found'));
      await expect(controller.create({ title: 'X', eventType: EventType.ASSAIG, date: '2026-05-10', seasonId: 'bad-id' }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // --- update (PUT) ---
  describe('update', () => {
    it('delegates to eventService.update with all fields', async () => {
      const dto = { title: 'Nou títol', countsForStatistics: false };
      await controller.update('ev-uuid', dto);
      expect(eventService.update).toHaveBeenCalledWith('ev-uuid', dto);
    });

    it('propagates NotFoundException when event not found', async () => {
      eventService.update.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.update('bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  // --- remove (DELETE) ---
  describe('remove', () => {
    it('delegates to eventService.remove', async () => {
      await controller.remove('ev-uuid');
      expect(eventService.remove).toHaveBeenCalledWith('ev-uuid');
    });

    it('propagates ConflictException when event has attendance', async () => {
      eventService.remove.mockRejectedValueOnce(new ConflictException('Té registres d\'assistència'));
      await expect(controller.remove('ev-uuid')).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when event not found', async () => {
      eventService.remove.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.remove('bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });

  // --- findAttendance ---
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

  // --- createAttendance ---
  describe('createAttendance', () => {
    it('delegates to attendanceService.create', async () => {
      const dto = { personId: 'p1', status: AttendanceStatus.ANIRE };
      const result = await controller.createAttendance('ev-uuid', dto);
      expect(attendanceService.create).toHaveBeenCalledWith('ev-uuid', dto);
      expect(result.attendance.status).toBe(AttendanceStatus.ANIRE);
    });

    it('propagates ConflictException on duplicate', async () => {
      attendanceService.create.mockRejectedValueOnce(new ConflictException('Ja existeix'));
      await expect(controller.createAttendance('ev-uuid', { personId: 'p1', status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when person not found', async () => {
      attendanceService.create.mockRejectedValueOnce(new NotFoundException('Person not found'));
      await expect(controller.createAttendance('ev-uuid', { personId: 'bad', status: AttendanceStatus.ANIRE }))
        .rejects.toThrow(NotFoundException);
    });
  });

  // --- updateAttendance ---
  describe('updateAttendance', () => {
    it('delegates to attendanceService.update', async () => {
      const dto = { status: AttendanceStatus.NO_PRESENTAT, notes: 'No va aparèixer' };
      await controller.updateAttendance('ev-uuid', 'att-uuid', dto);
      expect(attendanceService.update).toHaveBeenCalledWith('ev-uuid', 'att-uuid', dto);
    });

    it('propagates NotFoundException when attendance not found', async () => {
      attendanceService.update.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.updateAttendance('ev-uuid', 'bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  // --- removeAttendance ---
  describe('removeAttendance', () => {
    it('delegates to attendanceService.remove and returns summary', async () => {
      const result = await controller.removeAttendance('ev-uuid', 'att-uuid');
      expect(attendanceService.remove).toHaveBeenCalledWith('ev-uuid', 'att-uuid');
      expect(result).toHaveProperty('summary');
    });

    it('propagates NotFoundException when attendance not found', async () => {
      attendanceService.remove.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.removeAttendance('ev-uuid', 'bad-uuid')).rejects.toThrow(NotFoundException);
    });
  });
});
