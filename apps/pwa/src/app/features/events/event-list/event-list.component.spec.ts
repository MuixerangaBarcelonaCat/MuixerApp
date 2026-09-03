import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { of, throwError } from 'rxjs';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { EventListComponent } from './event-list.component';
import { EventService } from '../services/event.service';
import { ToastService } from '@muixer/ui';

const EMPTY_SUMMARY = {
  confirmed: 0,
  declined: 0,
  pending: 0,
  attended: 0,
  lateCancel: 0,
  children: 0,
  childrenAttended: 0,
  total: 0,
};

const MOCK_EVENT: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: '2026-06-23',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: EMPTY_SUMMARY,
  myAttendance: null,
  managedAttendances: [
    { personId: 'p-1', displayName: 'MartaP', isSelf: true, delegateType: null, attendance: null },
  ],
};

const MOCK_EVENTS_SEASON: MeEvent[] = [
  {
    ...MOCK_EVENT,
    id: 'ev-1',
    date: '2026-07-07',
  },
  {
    ...MOCK_EVENT,
    id: 'ev-2',
    date: '2026-07-14',
    eventType: EventType.ACTUACIO,
    title: 'Festa Major',
  },
  {
    ...MOCK_EVENT,
    id: 'ev-3',
    date: '2026-07-07',
    eventType: EventType.ACTUACIO,
    title: 'Matinal',
  },
];

describe('EventListComponent', () => {
  let fixture: ComponentFixture<EventListComponent>;
  let component: EventListComponent;
  let eventService: {
    findAll: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
  };

  async function stable(): Promise<void> {
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    eventService = {
      findAll: vi.fn().mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } }),
      ),
      updateAttendance: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventListComponent);
    component = fixture.componentInstance;
    await stable();
  });

  // --- List view tests ---

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load events on init', () => {
    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'upcoming' }),
    );
  });

  it('should display event cards when data loaded', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(1);
  });

  it('should show empty state when no events', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: [], meta: { total: 0, page: 1, limit: 50 } }),
    );
    component.setFilter('past');
    await stable();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should show error state on error', async () => {
    eventService.findAll.mockReturnValue(throwError(() => new Error('fail')));
    component.setFilter('all');
    await stable();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should switch filter tabs', async () => {
    component.setFilter('past');
    await stable();
    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'past' }),
    );
  });

  it('should render filter tabs in list mode', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it('should only offer Propers and Passats, not Tots', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(Array.from(tabs).map((t) => (t as HTMLElement).textContent?.trim())).toEqual([
      'Propers',
      'Passats',
    ]);
  });

  // --- Calendar view tests ---

  it('should default to list view', () => {
    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeFalsy();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(2);
  });

  it('should toggle to calendar view', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );
    component.toggleView();
    await stable();

    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeTruthy();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(0);
  });

  it('should toggle back to list view', async () => {
    component.toggleView();
    await stable();
    component.toggleView();
    await stable();

    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeFalsy();
  });

  it('should load all season events with limit 300 when switching to calendar', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );

    component.toggleView();
    await stable();

    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'all', limit: 300 }),
    );
  });

  it('should show event cards when a day is selected', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );

    component.toggleView();
    await stable();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(2);
  });

  it('should hide expanded cards when day is deselected', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );

    component.toggleView();
    await stable();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();
    component.onSelectedDateChange(null);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h3.text-sm.text-base-content\\/60');
    expect(heading).toBeFalsy();
  });

  it('should refresh calendar data on pull-to-refresh in calendar mode', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );

    component.toggleView();
    await stable();
    const callCountBefore = eventService.findAll.mock.calls.length;

    component.onRefresh();
    await stable();

    expect(eventService.findAll.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('should update calendar when attendance changes', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 300 } }),
    );

    component.toggleView();
    await stable();

    component.onAttendanceChanged({ eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(2);
  });

  it('should patch the matching managed person and myAttendance on attendance change', async () => {
    await stable();

    component.onAttendanceChanged({ eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('app-attendance-button button');
    expect(button.classList.contains('btn-success')).toBe(true);
  });

  // --- Pagination (infinite scroll) ---

  describe('loadMore', () => {
    beforeEach(async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 3, page: 1, limit: 50 } }),
      );
      component.setFilter('past');
      await stable();
    });

    it('appends the next page to the visible events', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENTS_SEASON[1]], meta: { total: 3, page: 2, limit: 50 } }),
      );

      component.loadMore();
      await stable();

      expect(eventService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ timeFilter: 'past', page: 2, limit: 50 }),
      );
      const cards = fixture.nativeElement.querySelectorAll('app-event-card');
      expect(cards.length).toBe(2);
    });

    it('does not request another page while one is already loading', async () => {
      const { Subject } = await import('rxjs');
      const pending = new Subject<{ data: MeEvent[]; meta: { total: number; page: number; limit: number } }>();
      eventService.findAll.mockReturnValue(pending);

      component.loadMore();
      const callCount = eventService.findAll.mock.calls.length;
      component.loadMore();

      expect(eventService.findAll.mock.calls.length).toBe(callCount);
      pending.complete();
    });

    it('stops offering more once every event has loaded', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENTS_SEASON[1], MOCK_EVENTS_SEASON[2]], meta: { total: 3, page: 2, limit: 50 } }),
      );

      component.loadMore();
      await stable();

      expect(fixture.nativeElement.querySelector('[appinfinitescroll]')).toBeFalsy();
    });

    it('discards a page that resolves after the filter has already changed', async () => {
      const { Subject } = await import('rxjs');
      const pending = new Subject<{ data: MeEvent[]; meta: { total: number; page: number; limit: number } }>();
      eventService.findAll.mockReturnValue(pending);

      component.loadMore();
      component.setFilter('upcoming');
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } }),
      );
      await stable();

      pending.next({ data: [MOCK_EVENTS_SEASON[1]], meta: { total: 3, page: 2, limit: 50 } });
      pending.complete();
      fixture.detectChanges();

      const cards = fixture.nativeElement.querySelectorAll('app-event-card');
      expect(cards.length).toBe(1);
    });

    it('resets accumulated pages when switching tabs', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENTS_SEASON[1]], meta: { total: 3, page: 2, limit: 50 } }),
      );
      component.loadMore();
      await stable();
      expect(fixture.nativeElement.querySelectorAll('app-event-card').length).toBe(2);

      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } }),
      );
      component.setFilter('upcoming');
      await stable();

      expect(fixture.nativeElement.querySelectorAll('app-event-card').length).toBe(1);
    });

    it('patches appended events on attendance change too', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENTS_SEASON[1]], meta: { total: 3, page: 2, limit: 50 } }),
      );
      component.loadMore();
      await stable();

      component.onAttendanceChanged({ eventId: 'ev-2', personId: 'p-1', status: AttendanceStatus.ANIRE });
      fixture.detectChanges();

      // Two <app-attendance-button> (one per card, ev-1 then the appended ev-2), each rendering
      // a Vinc/No-vinc button pair — the second card's first (Vinc) button is index 2.
      const buttons = fixture.nativeElement.querySelectorAll('app-attendance-button button');
      expect(buttons[2].classList.contains('btn-success')).toBe(true);
    });
  });
});
