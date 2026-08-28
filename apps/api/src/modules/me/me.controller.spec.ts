import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceStatus, DelegateType, EventType, JwtPayload, UserRole } from '@muixer/shared';
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
            findEventSegments: jest.fn(),
            findSegmentProjection: jest.fn(),
            resolveManagedPersons: jest.fn(),
            getPersonSummary: jest.fn(),
            listPersonDelegates: jest.fn(),
            createPersonDelegate: jest.fn(),
            removePersonDelegate: jest.fn(),
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

  describe('findEventSegments', () => {
    it('delegates to MeService with the user and the event id', async () => {
      const expected = [{ id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] }];
      meService.findEventSegments.mockResolvedValue(expected);

      const result = await controller.findEventSegments(mockUser, 'event-1', {});

      expect(meService.findEventSegments).toHaveBeenCalledWith(mockUser, 'event-1', undefined);
      expect(result).toEqual(expected);
    });
  });

  describe('findSegmentProjection', () => {
    it('delegates to MeService with the event id and segment id', async () => {
      const expected = { segment: { id: 'seg-1' } } as never;
      meService.findSegmentProjection.mockResolvedValue(expected);

      const result = await controller.findSegmentProjection('event-1', 'seg-1');

      expect(meService.findSegmentProjection).toHaveBeenCalledWith('event-1', 'seg-1');
      expect(result).toEqual(expected);
    });
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

  describe('listManagedPersons', () => {
    it('passes primaryOnly through to MeService.resolveManagedPersons', async () => {
      const expected = [
        { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null },
      ];
      meService.resolveManagedPersons.mockResolvedValue(expected);

      const result = await controller.listManagedPersons(mockUser, { primaryOnly: true });

      expect(meService.resolveManagedPersons).toHaveBeenCalledWith('user-1', { primaryOnly: true });
      expect(result).toEqual(expected);
    });

    it('passes undefined primaryOnly through when no filter is given', async () => {
      meService.resolveManagedPersons.mockResolvedValue([]);

      await controller.listManagedPersons(mockUser, {});

      expect(meService.resolveManagedPersons).toHaveBeenCalledWith('user-1', { primaryOnly: undefined });
    });
  });

  describe('getPersonSummary', () => {
    it('delegates to MeService with the current user id and personId', async () => {
      const expected = {
        personId: 'p-1',
        alias: 'MartaP',
        name: 'Marta',
        firstSurname: 'Puig',
        delegationCount: 1,
      };
      meService.getPersonSummary.mockResolvedValue(expected);

      const result = await controller.getPersonSummary(mockUser, 'p-1');

      expect(meService.getPersonSummary).toHaveBeenCalledWith('user-1', 'p-1');
      expect(result).toEqual(expected);
    });
  });

  describe('listPersonDelegates', () => {
    it('delegates to MeService and shapes the response via PersonDelegateResponseDto', async () => {
      meService.listPersonDelegates.mockResolvedValue([
        {
          id: 'del-1',
          delegateType: DelegateType.PARENT,
          isActive: true,
          isPrimary: false,
          createdAt: new Date('2026-01-01'),
          user: { id: 'user-2', email: 'joan@test.cat', person: null },
          person: { id: 'p-1', alias: 'MartaP' },
        } as never,
      ]);

      const result = await controller.listPersonDelegates(mockUser, 'p-1');

      expect(meService.listPersonDelegates).toHaveBeenCalledWith('user-1', 'p-1');
      expect(result).toEqual([
        expect.objectContaining({ id: 'del-1', delegateType: DelegateType.PARENT, isPrimary: false }),
      ]);
    });
  });

  describe('createPersonDelegate', () => {
    it('delegates to MeService and shapes the response via PersonDelegateResponseDto', async () => {
      const dto = { alias: 'JoanP', delegateType: DelegateType.PARTNER };
      meService.createPersonDelegate.mockResolvedValue({
        id: 'del-new',
        delegateType: DelegateType.PARTNER,
        isActive: true,
        isPrimary: false,
        createdAt: new Date('2026-01-01'),
        user: { id: 'user-2', email: 'joan@test.cat', person: null },
        person: { id: 'p-1', alias: 'MartaP' },
      } as never);

      const result = await controller.createPersonDelegate(mockUser, 'p-1', dto as never);

      expect(meService.createPersonDelegate).toHaveBeenCalledWith('user-1', 'p-1', dto);
      expect(result).toEqual(expect.objectContaining({ id: 'del-new', delegateType: DelegateType.PARTNER }));
    });
  });

  describe('removePersonDelegate', () => {
    it('delegates to MeService with user id, personId and delegateId', async () => {
      meService.removePersonDelegate.mockResolvedValue(undefined);

      await controller.removePersonDelegate(mockUser, 'p-1', 'del-1');

      expect(meService.removePersonDelegate).toHaveBeenCalledWith('user-1', 'p-1', 'del-1');
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
