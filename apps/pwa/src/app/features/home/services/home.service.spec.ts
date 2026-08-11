import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of, throwError } from 'rxjs';
import { EventType, MeEvent, AttendanceSummary } from '@muixer/shared';
import { HomeService } from './home.service';
import { EventService } from '../../events/services/event.service';

const EMPTY_SUMMARY: AttendanceSummary = {
  confirmed: 0,
  declined: 0,
  pending: 0,
  attended: 0,
  lateCancel: 0,
  children: 0,
  childrenAttended: 0,
  total: 0,
};

const MOCK_REHEARSAL: MeEvent = {
  id: 'r-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: '2026-07-10',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: EMPTY_SUMMARY,
  myAttendance: null,
  managedAttendances: [],
};

const MOCK_PERFORMANCE: MeEvent = {
  id: 'p-1',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
  date: '2026-07-15',
  startTime: '11:00',
  location: 'Plaça',
  attendanceSummary: EMPTY_SUMMARY,
  myAttendance: null,
  managedAttendances: [],
};

describe('HomeService', () => {
  let service: HomeService;
  let eventService: { findAll: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    eventService = { findAll: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        HomeService,
        { provide: EventService, useValue: eventService },
      ],
    });

    service = TestBed.inject(HomeService);
  });

  it('should return next rehearsal and performance', async () => {
    eventService.findAll.mockImplementation((filters: { type: EventType }) => {
      if (filters.type === EventType.ASSAIG) {
        return of({ data: [MOCK_REHEARSAL], meta: { total: 1, page: 1, limit: 1 } });
      }
      return of({ data: [MOCK_PERFORMANCE], meta: { total: 1, page: 1, limit: 1 } });
    });

    const data = await firstValueFrom(service.loadHomeData());

    expect(data.nextRehearsal).toEqual(MOCK_REHEARSAL);
    expect(data.nextPerformance).toEqual(MOCK_PERFORMANCE);
  });

  it('should return null when no events of a type exist', async () => {
    eventService.findAll.mockImplementation((filters: { type: EventType }) => {
      if (filters.type === EventType.ASSAIG) {
        return of({ data: [], meta: { total: 0, page: 1, limit: 1 } });
      }
      return of({ data: [MOCK_PERFORMANCE], meta: { total: 1, page: 1, limit: 1 } });
    });

    const data = await firstValueFrom(service.loadHomeData());

    expect(data.nextRehearsal).toBeNull();
    expect(data.nextPerformance).toEqual(MOCK_PERFORMANCE);
  });

  it('should return nulls when no upcoming events exist', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: [], meta: { total: 0, page: 1, limit: 1 } }),
    );

    const data = await firstValueFrom(service.loadHomeData());

    expect(data.nextRehearsal).toBeNull();
    expect(data.nextPerformance).toBeNull();
  });

  it('should propagate API error from forkJoin', async () => {
    eventService.findAll.mockImplementation((filters: { type: EventType }) => {
      if (filters.type === EventType.ASSAIG) {
        return throwError(() => new Error('Network error'));
      }
      return of({ data: [MOCK_PERFORMANCE], meta: { total: 1, page: 1, limit: 1 } });
    });

    await expect(firstValueFrom(service.loadHomeData()))
      .rejects.toThrow('Network error');
  });
});
