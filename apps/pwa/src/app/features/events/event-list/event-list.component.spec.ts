import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, input, output } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { EventListComponent } from './event-list.component';
import { EventService } from '../services/event.service';
import { EventFeedComponent } from '../components/event-feed/event-feed.component';

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

const MOCK_EVENTS: MeEvent[] = [
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

// Stub out the feed entirely — its own behavior (pagination, loading/error/empty states) is
// covered by event-feed.component.spec.ts. Here we only care about what EventListComponent wires
// into it, and about the calendar view it owns directly.
@Component({
  selector: 'app-event-feed',
  standalone: true,
  template: '',
})
class EventFeedStub {
  readonly timeFilter = input.required<'upcoming' | 'past'>();
  readonly emptyMessage = input.required<string>();
  readonly attendanceChanged = output<{ eventId: string; personId: string; status: AttendanceStatus }>();
}

describe('EventListComponent', () => {
  let fixture: ComponentFixture<EventListComponent>;
  let component: EventListComponent;
  let eventService: { findAll: ReturnType<typeof vi.fn> };

  async function stable(): Promise<void> {
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    eventService = {
      findAll: vi.fn().mockReturnValue(
        of({ data: MOCK_EVENTS, meta: { total: 3, page: 1, limit: 300 } }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        { provide: EventService, useValue: eventService },
        provideRouter([]),
      ],
    })
      .overrideComponent(EventListComponent, {
        remove: { imports: [EventFeedComponent] },
        add: { imports: [EventFeedStub] },
      })
      .compileComponents();

    fixture = TestBed.createComponent(EventListComponent);
    component = fixture.componentInstance;
    await stable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should default to list view, showing the upcoming feed', () => {
    const feed = fixture.debugElement.query(By.directive(EventFeedStub));
    expect(feed).toBeTruthy();
    expect(feed.componentInstance.timeFilter()).toBe('upcoming');
  });

  it('should link to the past-events screen', () => {
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a');
    expect(link.getAttribute('href')).toBe('/events/past');
    expect(link.textContent).toContain('Passats');
  });

  it('should not offer Propers/Passats tabs any more', () => {
    expect(fixture.nativeElement.querySelectorAll('[role="tab"]').length).toBe(0);
  });

  // --- Calendar view ---

  it('should toggle to calendar view', async () => {
    component.toggleView();
    await stable();

    const calendarView = fixture.nativeElement.querySelector('app-calendar-view');
    expect(calendarView).toBeTruthy();
    expect(fixture.debugElement.query(By.directive(EventFeedStub))).toBeFalsy();
  });

  it('should toggle back to list view', async () => {
    component.toggleView();
    await stable();
    component.toggleView();
    await stable();

    expect(fixture.nativeElement.querySelector('app-calendar-view')).toBeFalsy();
    expect(fixture.debugElement.query(By.directive(EventFeedStub))).toBeTruthy();
  });

  it('should load all events with limit 300 when switching to calendar', async () => {
    component.toggleView();
    await stable();

    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'all', limit: 300 }),
    );
  });

  it('should show event cards when a day is selected', async () => {
    component.toggleView();
    await stable();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(2);
  });

  it('should hide expanded cards when day is deselected', async () => {
    component.toggleView();
    await stable();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();
    component.onSelectedDateChange(null);
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h3.text-sm.text-base-content\\/60');
    expect(heading).toBeFalsy();
  });

  it('should show error state when the calendar fails to load', async () => {
    eventService.findAll.mockReturnValue(throwError(() => new Error('fail')));
    component.toggleView();
    await stable();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should refresh calendar data on pull-to-refresh', async () => {
    component.toggleView();
    await stable();
    const callCountBefore = eventService.findAll.mock.calls.length;

    component.onCalendarRefresh();
    await stable();

    expect(eventService.findAll.mock.calls.length).toBeGreaterThan(callCountBefore);
  });

  it('should patch the calendar when the upcoming feed reports an attendance change', async () => {
    component.toggleView();
    await stable();

    component.onAttendanceChanged({ eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE });
    fixture.detectChanges();

    component.onSelectedDateChange('2026-07-07');
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector('app-attendance-button button');
    expect(button.classList.contains('btn-success')).toBe(true);
  });
});
