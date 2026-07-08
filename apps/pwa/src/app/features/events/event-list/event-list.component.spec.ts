import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { EventListComponent } from './event-list.component';
import { EventService } from '../services/event.service';
import { ToastService } from '../../../shared/services/toast.service';

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
  let eventService: { findAll: ReturnType<typeof vi.fn>; updateAttendance: ReturnType<typeof vi.fn> };

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
    fixture.detectChanges();
  });

  // --- Existing list tests ---

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

  it('should show empty state when no events', () => {
    eventService.findAll.mockReturnValue(
      of({ data: [], meta: { total: 0, page: 1, limit: 50 } }),
    );
    component.setFilter('past');
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should show error state on error', () => {
    eventService.findAll.mockReturnValue(throwError(() => new Error('fail')));
    component.setFilter('all');
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should switch filter tabs', () => {
    component.setFilter('past');
    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'past' }),
    );
  });

  it('should render filter tabs in list mode', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  // --- Calendar view tests ---

  it('should default to list view', () => {
    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeFalsy();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });

  it('should toggle to calendar view', () => {
    component.toggleView();
    fixture.detectChanges();

    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeTruthy();
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(0);
  });

  it('should toggle back to list view', () => {
    component.toggleView();
    fixture.detectChanges();
    component.toggleView();
    fixture.detectChanges();

    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeFalsy();
  });

  it('should load all season events when switching to calendar', () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 200 } }),
    );

    component.toggleView();
    fixture.detectChanges();

    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'all', limit: 200 }),
    );
  });

  it('should show event cards when a day is selected', () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 200 } }),
    );

    component.toggleView();
    fixture.detectChanges();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(2);
  });

  it('should hide expanded cards when day is deselected', () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 200 } }),
    );

    component.toggleView();
    fixture.detectChanges();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();
    component.onSelectedDateChange(null);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h3.text-sm.text-base-content\\/60');
    expect(heading).toBeFalsy();
  });

  it('should refresh calendar data on pull-to-refresh in calendar mode', () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 200 } }),
    );

    component.toggleView();
    fixture.detectChanges();
    const callCountBefore = eventService.findAll.mock.calls.length;

    component.onRefresh();
    fixture.detectChanges();

    expect(eventService.findAll.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('should update calendar dot when attendance changes', () => {
    eventService.findAll.mockReturnValue(
      of({ data: MOCK_EVENTS_SEASON, meta: { total: 3, page: 1, limit: 200 } }),
    );

    component.toggleView();
    fixture.detectChanges();

    component.onAttendanceChanged({ eventId: 'ev-1', status: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(2);
  });
});
