import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
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
  let eventService: { findAll: ReturnType<typeof vi.fn>; updateAttendance: ReturnType<typeof vi.fn> };

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
});
