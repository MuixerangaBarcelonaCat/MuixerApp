import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus, EventType, JwtPayload, UserRole } from '@muixer/shared';
import { MeController } from './me.controller';
import { MeService } from './me.service';

const mockUser: JwtPayload = {
  sub: 'user-1',
  email: 'test@test.com',
  role: UserRole.MEMBER,
};

describe('MeController', () => {
  let controller: MeController;
  let meService: jest.Mocked<MeService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MeController],
      providers: [
        {
          provide: MeService,
          useValue: {
            findEvents: jest.fn(),
            findEventDetail: jest.fn(),
            upsertAttendance: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get(MeController);
    meService = module.get(MeService);
  });

  it('should call findEvents with user and filters', async () => {
    const expected = { data: [], meta: { total: 0, page: 1, limit: 20 } };
    meService.findEvents.mockResolvedValue(expected);

    const result = await controller.findEvents(mockUser, { timeFilter: 'upcoming' });

    expect(result).toEqual(expected);
    expect(meService.findEvents).toHaveBeenCalledWith(mockUser, { timeFilter: 'upcoming' });
  });

  it('should call findEventDetail with user and id', async () => {
    const expected = {
      id: 'event-1',
      eventType: EventType.ASSAIG,
      title: 'Assaig',
      date: '2026-07-01',
      startTime: '20:00',
      location: 'Local',
      attendanceSummary: {} as never,
      myAttendance: null,
      description: null,
      locationUrl: null,
      information: null,
    };
    meService.findEventDetail.mockResolvedValue(expected);

    const result = await controller.findEventDetail(mockUser, 'event-1');

    expect(result).toEqual(expected);
    expect(meService.findEventDetail).toHaveBeenCalledWith(mockUser, 'event-1');
  });

  it('should call upsertAttendance with user, id and dto', async () => {
    const expected = {
      id: 'att-1',
      status: AttendanceStatus.ANIRE,
      respondedAt: new Date().toISOString(),
    };
    meService.upsertAttendance.mockResolvedValue(expected);

    const dto = { status: AttendanceStatus.ANIRE };
    const result = await controller.upsertAttendance(mockUser, 'event-1', dto);

    expect(result).toEqual(expected);
    expect(meService.upsertAttendance).toHaveBeenCalledWith(mockUser, 'event-1', dto);
  });

  it('should pass type filter through to service', async () => {
    meService.findEvents.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 20 } });

    await controller.findEvents(mockUser, { type: EventType.ACTUACIO });

    expect(meService.findEvents).toHaveBeenCalledWith(mockUser, { type: EventType.ACTUACIO });
  });

  it('should pass pagination params to service', async () => {
    meService.findEvents.mockResolvedValue({ data: [], meta: { total: 0, page: 2, limit: 10 } });

    await controller.findEvents(mockUser, { page: 2, limit: 10 });

    expect(meService.findEvents).toHaveBeenCalledWith(mockUser, { page: 2, limit: 10 });
  });
});
