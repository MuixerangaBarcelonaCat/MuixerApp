import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
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
  attendance: { status: AttendanceStatus.ANIRE, respondedAt: new Date(), notes: null, person: { id: 'p1', alias: 'Joan', name: 'Joan', firstSurname: 'García', isXicalla: false, positions: [] } },
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
      set: jest.fn().mockResolvedValue(mockAttendanceResponse),
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

    it('propagates BadRequestException from service when the date is in no season', async () => {
      eventService.create.mockRejectedValueOnce(new BadRequestException('fora de temporada'));
      await expect(controller.create({ title: 'X', eventType: EventType.ASSAIG, date: '2030-08-01' }))
        .rejects.toThrow(BadRequestException);
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

  // --- setAttendance ---
  describe('setAttendance', () => {
    const mockUser = { sub: 'user-1', email: 'test@test.com', role: 'TECHNICAL' } as never;

    it('delegates to attendanceService.set keyed by person', async () => {
      const dto = { status: AttendanceStatus.ASSISTIT, notes: 'Va aparèixer' };
      const result = await controller.setAttendance(mockUser, 'ev-uuid', 'p1', dto);
      expect(attendanceService.set).toHaveBeenCalledWith('ev-uuid', 'p1', dto, 'user-1');
      expect(result).toHaveProperty('summary');
    });

    it('propagates NotFoundException when the person is not found', async () => {
      attendanceService.set.mockRejectedValueOnce(new NotFoundException());
      await expect(controller.setAttendance(mockUser, 'ev-uuid', 'bad-uuid', {})).rejects.toThrow(NotFoundException);
    });
  });

  it('exposes no create, update-by-id or delete attendance handlers', () => {
    const handlers = controller as unknown as Record<string, unknown>;
    expect(handlers.createAttendance).toBeUndefined();
    expect(handlers.updateAttendance).toBeUndefined();
    expect(handlers.removeAttendance).toBeUndefined();
  });
});
