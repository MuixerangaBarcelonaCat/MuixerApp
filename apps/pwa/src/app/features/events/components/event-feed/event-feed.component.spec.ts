import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef, Component, signal } from '@angular/core';
import { of, throwError, Subject } from 'rxjs';
import { AttendanceStatus, EventType, MeEvent } from '@muixer/shared';
import { EventFeedComponent } from './event-feed.component';
import { EventService } from '../../services/event.service';
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

const MOCK_EVENT_2: MeEvent = {
  ...MOCK_EVENT,
  id: 'ev-2',
  date: '2026-07-14',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
};

type FindAllResult = { data: MeEvent[]; meta: { total: number; page: number; limit: number } };

@Component({
  standalone: true,
  imports: [EventFeedComponent],
  template: `<app-event-feed
    [timeFilter]="timeFilter()"
    emptyMessage="No hi ha assajos ni actuacions."
    (attendanceChanged)="onAttendanceChanged($event)"
  />`,
})
class TestHostComponent {
  readonly timeFilter = signal<'upcoming' | 'past'>('upcoming');
  emitted: { eventId: string; personId: string; status: AttendanceStatus }[] = [];
  onAttendanceChanged(change: { eventId: string; personId: string; status: AttendanceStatus }): void {
    this.emitted.push(change);
  }
}

describe('EventFeedComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let feed: EventFeedComponent;
  let eventService: { findAll: ReturnType<typeof vi.fn> };

  async function stable(): Promise<void> {
    fixture.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    eventService = {
      findAll: vi.fn().mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } } satisfies FindAllResult),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TestHostComponent);
    feed = fixture.debugElement.children[0].componentInstance;
    await stable();
  });

  it('should create', () => {
    expect(feed).toBeTruthy();
  });

  it('should fetch page 1 for the given timeFilter on init', () => {
    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'upcoming', page: 1, limit: 50 }),
    );
  });

  it('should display event cards when data loaded', () => {
    const cards = fixture.nativeElement.querySelectorAll('app-event-card');
    expect(cards.length).toBe(1);
  });

  it('should show empty state when no events', async () => {
    eventService.findAll.mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 50 } }));
    fixture.componentInstance.timeFilter.set('past');
    await stable();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should show error state on error', async () => {
    eventService.findAll.mockReturnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.timeFilter.set('past');
    await stable();

    expect(fixture.nativeElement.querySelector('app-empty-state')).toBeTruthy();
  });

  it('should re-fetch when timeFilter changes and reset accumulated pages', async () => {
    eventService.findAll.mockReturnValue(
      of({ data: [MOCK_EVENT, MOCK_EVENT_2], meta: { total: 2, page: 1, limit: 50 } }),
    );
    fixture.componentInstance.timeFilter.set('past');
    await stable();

    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'past', page: 1 }),
    );
    expect(fixture.nativeElement.querySelectorAll('app-event-card').length).toBe(2);
  });

  describe('loadMore', () => {
    beforeEach(async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 2, page: 1, limit: 50 } }),
      );
      fixture.componentInstance.timeFilter.set('past');
      await stable();
    });

    it('appends the next page to the visible events', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT_2], meta: { total: 2, page: 2, limit: 50 } }),
      );

      feed.loadMore();
      await stable();

      expect(eventService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ timeFilter: 'past', page: 2, limit: 50 }),
      );
      expect(fixture.nativeElement.querySelectorAll('app-event-card').length).toBe(2);
    });

    it('does not request another page while one is already loading', () => {
      const pending = new Subject<FindAllResult>();
      eventService.findAll.mockReturnValue(pending);

      feed.loadMore();
      const callCount = eventService.findAll.mock.calls.length;
      feed.loadMore();

      expect(eventService.findAll.mock.calls.length).toBe(callCount);
      pending.complete();
    });

    it('stops offering more once every event has loaded', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT_2], meta: { total: 2, page: 2, limit: 50 } }),
      );

      feed.loadMore();
      await stable();

      expect(fixture.nativeElement.querySelector('[appinfinitescroll]')).toBeFalsy();
    });

    it('discards a page that resolves after a reset (e.g. pull-to-refresh) invalidated it', async () => {
      const pending = new Subject<FindAllResult>();
      eventService.findAll.mockReturnValue(pending);

      feed.loadMore();
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } }),
      );
      feed.onRefresh();
      await stable();

      pending.next({ data: [MOCK_EVENT_2], meta: { total: 2, page: 2, limit: 50 } });
      pending.complete();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelectorAll('app-event-card').length).toBe(1);
    });
  });

  describe('attendance changes', () => {
    it('patches the matching event and re-emits the change', async () => {
      feed.onAttendanceChanged({ eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE });
      fixture.detectChanges();

      const button = fixture.nativeElement.querySelector('app-attendance-button button');
      expect(button.classList.contains('btn-success')).toBe(true);
      expect(fixture.componentInstance.emitted).toEqual([
        { eventId: 'ev-1', personId: 'p-1', status: AttendanceStatus.ANIRE },
      ]);
    });

    it('patches an appended (loaded-more) event too', async () => {
      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 2, page: 1, limit: 50 } }),
      );
      fixture.componentInstance.timeFilter.set('past');
      await stable();

      eventService.findAll.mockReturnValue(
        of({ data: [MOCK_EVENT_2], meta: { total: 2, page: 2, limit: 50 } }),
      );
      feed.loadMore();
      await stable();

      feed.onAttendanceChanged({ eventId: 'ev-2', personId: 'p-1', status: AttendanceStatus.ANIRE });
      fixture.detectChanges();

      const buttons = fixture.nativeElement.querySelectorAll('app-attendance-button button');
      expect(buttons[2].classList.contains('btn-success')).toBe(true);
    });
  });
});
