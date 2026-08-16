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
            getPendingDependents: jest.fn(),
            completePendingDependent: jest.fn(),
            findNews: jest.fn(),
            findNewsDetail: jest.fn(),
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
      managedAttendances: [],
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

  describe('getPendingDependents', () => {
    it('delegates to MeService with the current user id', async () => {
      const expected = [
        {
          personId: 'child-1',
          alias: 'xicalla1',
          name: 'Joan',
          firstSurname: 'Garcia',
          secondSurname: null,
          gender: null,
          phone: null,
          birthDate: null,
        },
      ];
      meService.getPendingDependents.mockResolvedValue(expected);

      const result = await controller.getPendingDependents(mockUser);

      expect(meService.getPendingDependents).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });

  describe('completePendingDependent', () => {
    it('delegates to MeService with the current user id and dto', async () => {
      meService.completePendingDependent.mockResolvedValue(undefined);
      const dto = {
        personId: 'child-1',
        name: 'Joan',
        firstSurname: 'Garcia',
        gender: 'MALE',
        phone: '+34612345678',
        birthDate: '2015-01-15',
      };

      await controller.completePendingDependent(mockUser, dto as never);

      expect(meService.completePendingDependent).toHaveBeenCalledWith('user-1', dto);
    });
  });

  describe('findNews', () => {
    it('delegates to MeService.findNews', async () => {
      const expected = [{ id: 'news-1', title: 'Nova temporada', publishedAt: '2026-01-01T00:00:00.000Z', body: 'Cos' }];
      meService.findNews.mockResolvedValue(expected);

      const result = await controller.findNews();

      expect(result).toEqual(expected);
      expect(meService.findNews).toHaveBeenCalled();
    });
  });

  describe('findNewsDetail', () => {
    it('delegates to MeService.findNewsDetail with the news id', async () => {
      const expected = {
        id: 'news-1',
        title: 'Nova temporada',
        publishedAt: '2026-01-01T00:00:00.000Z',
        body: 'Cos',
      };
      meService.findNewsDetail.mockResolvedValue(expected);

      const result = await controller.findNewsDetail('news-1');

      expect(result).toEqual(expected);
      expect(meService.findNewsDetail).toHaveBeenCalledWith('news-1');
    });
  });
});
