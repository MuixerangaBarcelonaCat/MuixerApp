import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { EventType, MeEvent } from '@muixer/shared';
import { EventListComponent } from './event-list.component';
import { EventService } from '../services/event.service';
import { ToastService } from '../../../shared/services/toast.service';

const MOCK_EVENT: MeEvent = {
  id: 'ev-1',
  eventType: EventType.ASSAIG,
  title: 'Assaig',
  date: '2026-06-23',
  startTime: '20:00',
  location: 'Local',
  attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, noShow: 0, lateCancel: 0, children: 0, total: 0 },
  myAttendance: null,
};

describe('EventListComponent', () => {
  let fixture: ComponentFixture<EventListComponent>;
  let eventService: { findAll: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    eventService = {
      findAll: vi.fn().mockReturnValue(
        of({ data: [MOCK_EVENT], meta: { total: 1, page: 1, limit: 50 } }),
      ),
    };

    await TestBed.configureTestingModule({
      imports: [EventListComponent],
      providers: [
        { provide: EventService, useValue: { ...eventService, updateAttendance: vi.fn() } },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EventListComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
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
    fixture.componentInstance.setFilter('past');
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should show error state on error', () => {
    eventService.findAll.mockReturnValue(throwError(() => new Error('fail')));
    fixture.componentInstance.setFilter('all');
    fixture.detectChanges();
    const emptyState = fixture.nativeElement.querySelector('app-empty-state');
    expect(emptyState).toBeTruthy();
  });

  it('should switch filter tabs', () => {
    fixture.componentInstance.setFilter('past');
    expect(eventService.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ timeFilter: 'past' }),
    );
  });

  it('should render filter tabs', () => {
    const tabs = fixture.nativeElement.querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
  });
});
