import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import {
  AttendanceStatus,
  DelegateType,
  EventAttendanceStats,
  EventType,
  MeEventDetail,
  MeSegment,
  UserRole,
} from '@muixer/shared';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { EventService } from '../services/event.service';
import { AuthService } from '../../../core/auth/services/auth.service';
import { ToastService } from '@muixer/ui';
import { provideRouter } from '@angular/router';
import { Component } from '@angular/core';

const MOCK_DETAIL: MeEventDetail = {
  id: 'ev-1',
  eventType: EventType.ACTUACIO,
  title: 'Festa Major',
  date: '2026-07-15',
  startTime: '11:00',
  location: 'Plaça Sant Jaume',
  locationUrl: 'https://maps.google.com',
  description: 'Actuació principal',
  information: 'Portar mocador',
  attendanceSummary: { confirmed: 5, declined: 2, pending: 3, attended: 0, lateCancel: 0, children: 1, childrenAttended: 0, total: 10 },
  myAttendance: null,
  managedAttendances: [
    { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null, attendance: null },
  ],
};

@Component({
  standalone: true,
  imports: [EventDetailComponent],
  template: `<app-event-detail [id]="'ev-1'" />`,
})
class TestHostComponent {}

describe('EventDetailComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let eventService: {
    findOne: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
    findSegments: ReturnType<typeof vi.fn>;
    getAttendanceStats: ReturnType<typeof vi.fn>;
  };
  let authService: {
    userRole: ReturnType<typeof vi.fn>;
  };

  const MOCK_ATTENDANCE_STATS: EventAttendanceStats = {
    byStatus: {
      PENDENT: { adults: 3, xicalla: 1 },
      ANIRE: { adults: 5, xicalla: 2 },
      NO_VAIG: { adults: 1, xicalla: 0 },
      ASSISTIT: { adults: 0, xicalla: 0 },
    },
    coming: { adults: 5, xicalla: 2 },
  };

  async function setup(
    findOneReturn = of(MOCK_DETAIL),
    findSegmentsReturn = of<MeSegment[]>([]),
    userRole = UserRole.MEMBER,
    attendanceStatsReturn = of(MOCK_ATTENDANCE_STATS),
  ) {
    eventService = {
      findOne: vi.fn().mockReturnValue(findOneReturn),
      updateAttendance: vi.fn(),
      findSegments: vi.fn().mockReturnValue(findSegmentsReturn),
      getAttendanceStats: vi.fn().mockReturnValue(attendanceStatsReturn),
    };
    authService = {
      userRole: vi.fn().mockReturnValue(userRole),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: eventService },
        { provide: AuthService, useValue: authService },
        { provide: ToastService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    }).compileComponents();

    const f = TestBed.createComponent(TestHostComponent);
    f.detectChanges();
    await TestBed.inject(ApplicationRef).whenStable();
    f.detectChanges();
    return f;
  }

  it('should load event detail', async () => {
    fixture = await setup();
    expect(eventService.findOne).toHaveBeenCalledWith('ev-1');
  });

  it('should display event title', async () => {
    fixture = await setup();
    const title = fixture.nativeElement.querySelector('.card-title');
    expect(title).toBeTruthy();
    expect(title.textContent).toContain('Festa Major');
  });

  it('should display description', async () => {
    fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Actuació principal');
  });

  it('should display information', async () => {
    fixture = await setup();
    expect(fixture.nativeElement.textContent).toContain('Portar mocador');
  });

  it('should show location with link', async () => {
    fixture = await setup();
    const link = fixture.nativeElement.querySelector('a.link');
    expect(link).toBeTruthy();
    expect(link.textContent).toContain('Plaça Sant Jaume');
  });

  it('should show error state on failure', async () => {
    fixture = await setup(throwError(() => new Error('fail')));
    expect(fixture.nativeElement.textContent).toContain("No s'ha pogut carregar");
  });

  describe('tap targets >=24px (WI-03, PW-L4)', () => {
    it('gives the location link a real >=24px tap target instead of the bare glyph height', async () => {
      fixture = await setup();
      const link = fixture.nativeElement.querySelector('a.link') as HTMLElement;
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    });
  });

  describe('managed attendances', () => {
    it('should render a single attendance button without a name label for one managed person', async () => {
      fixture = await setup();
      const buttons = fixture.debugElement.queryAll(By.directive(AttendanceButtonComponent));
      expect(buttons.length).toBe(1);
      expect(fixture.nativeElement.querySelector('.managed-person-name')).toBeNull();
    });

    it('should render one button per managed person, self first then delegates', async () => {
      const detail: MeEventDetail = {
        ...MOCK_DETAIL,
        managedAttendances: [
          { personId: 'p-1', displayName: 'Marta Puig', isSelf: true, delegateType: null, attendance: null },
          {
            personId: 'p-2',
            displayName: 'Joan Puig',
            isSelf: false,
            delegateType: DelegateType.PARENT,
            attendance: { id: 'att-2', status: AttendanceStatus.ANIRE, respondedAt: '2026-07-01T10:00:00Z' },
          },
        ],
      };
      fixture = await setup(of(detail));

      const buttons = fixture.debugElement.queryAll(By.directive(AttendanceButtonComponent));
      expect(buttons.length).toBe(2);
      expect(buttons.map((b) => b.componentInstance.personId())).toEqual(['p-1', 'p-2']);
      expect(buttons[1].componentInstance.status()).toBe(AttendanceStatus.ANIRE);

      const names = fixture.nativeElement.textContent;
      expect(names).toContain('Marta Puig');
      expect(names).toContain('Joan Puig');
    });
  });

  describe('segments', () => {
    it('renders one row per published segment', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
        { id: 'seg-2', name: 'Bloc 2', sortOrder: 1, instances: [], myPlacements: [] },
      ]));

      const rows = fixture.nativeElement.querySelectorAll('a.segment-row');
      expect(rows.length).toBe(2);
    });

    it('does not render the segments section when the list is empty', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([]));

      expect(fixture.nativeElement.querySelector('.segments-section')).toBeNull();
    });

    it('falls back to "Segment sense nom" when the name is null and there are no instances', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: null, sortOrder: 2, instances: [], myPlacements: [] },
      ]));

      expect(fixture.nativeElement.textContent).toContain('Segment sense nom');
    });

    it('derives the title from figures when the name is null, matching the Dashboard', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        {
          id: 'seg-1',
          name: null,
          sortOrder: 0,
          instances: [
            { label: null, figureMode: 'COMPLETA', figureTemplate: { name: 'pd4', hasPinya: true } },
            { label: null, figureMode: 'COMPLETA', figureTemplate: { name: 'Morera', hasPinya: true } },
          ],
          myPlacements: [],
        },
      ]));

      expect(fixture.nativeElement.textContent).toContain('pd4 + Morera');
    });

    it('links each row to the segment projection route', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
      ]));

      const row = fixture.nativeElement.querySelector('a.segment-row') as HTMLAnchorElement;
      expect(row.getAttribute('href')).toBe('/events/ev-1/segments/seg-1');
    });

    it('does not render a "Segments" section heading', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
      ]));

      const section = fixture.nativeElement.querySelector('.segments-section') as HTMLElement;
      expect(section.querySelector('h3')).toBeNull();
      expect(section.textContent).not.toContain('Segments');
    });

    it('shows the segment order (1-based) in a square badge', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
        { id: 'seg-2', name: 'Bloc 2', sortOrder: 1, instances: [], myPlacements: [] },
      ]));

      const badges = fixture.nativeElement.querySelectorAll('.segment-row span:first-child');
      expect(badges[0].textContent?.trim()).toBe('1');
      expect(badges[1].textContent?.trim()).toBe('2');
      expect(badges[0].className).toContain('bg-primary');
      expect(badges[0].className).toContain('rounded');
    });

    it('places the segments section above attendance when the event has already started (isPast)', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: '2020-01-01' }), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
      ]));

      const segmentsEl = fixture.nativeElement.querySelector('.segments-section') as HTMLElement;
      const attendanceEl = fixture.nativeElement.querySelector('.attendance-section') as HTMLElement;
      expect(segmentsEl.style.order).toBe('1');
      expect(attendanceEl.style.order).toBe('2');
    });

    it('places attendance above the segments section when the event has not started yet', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: '2099-01-01' }), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
      ]));

      const segmentsEl = fixture.nativeElement.querySelector('.segments-section') as HTMLElement;
      const attendanceEl = fixture.nativeElement.querySelector('.attendance-section') as HTMLElement;
      expect(attendanceEl.style.order).toBe('1');
      expect(segmentsEl.style.order).toBe('2');
    });
  });

  describe('roll-call link ("Passa llista")', () => {
    const TODAY = new Date().toISOString().slice(0, 10);

    it('shows it for TECHNICAL on the day of the event', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: TODAY }), of([]), UserRole.TECHNICAL);
      const link = fixture.nativeElement.querySelector('[data-testid="roll-call-link"] a');
      expect(link).toBeTruthy();
      expect(link.textContent).toContain('Passa llista');
    });

    it('shows it for ADMIN on the day of the event', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: TODAY }), of([]), UserRole.ADMIN);
      expect(fixture.nativeElement.querySelector('[data-testid="roll-call-link"] a')).toBeTruthy();
    });

    it('hides it for MEMBER even on the day of the event', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: TODAY }), of([]), UserRole.MEMBER);
      expect(fixture.nativeElement.querySelector('[data-testid="roll-call-link"] a')).toBeFalsy();
    });

    // ponytail: the day-of-only restriction is temporarily disabled (see
    // `ENFORCE_ROLL_CALL_DATE_RESTRICTION` in the component) for real-time-refresh testing —
    // these two now assert the (temporary) always-shown behavior instead of the hidden one.
    it('still shows it for TECHNICAL on a future event while the date restriction is disabled', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: '2099-01-01' }), of([]), UserRole.TECHNICAL);
      expect(fixture.nativeElement.querySelector('[data-testid="roll-call-link"] a')).toBeTruthy();
    });

    it('still shows it for TECHNICAL on a past event while the date restriction is disabled', async () => {
      fixture = await setup(of({ ...MOCK_DETAIL, date: '2020-01-01' }), of([]), UserRole.TECHNICAL);
      expect(fixture.nativeElement.querySelector('[data-testid="roll-call-link"] a')).toBeTruthy();
    });
  });

  describe('attendance stats box (staff only)', () => {
    it('is hidden for a MEMBER account', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([]), UserRole.MEMBER);
      expect(eventService.getAttendanceStats).not.toHaveBeenCalled();
      expect(fixture.nativeElement.querySelector('[data-testid="attendance-stats-box"]')).toBeNull();
    });

    it('fetches and renders the breakdown for TECHNICAL, hiding "Assistit" for an actuació', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([]), UserRole.TECHNICAL);
      expect(eventService.getAttendanceStats).toHaveBeenCalledWith('ev-1');
      const box = fixture.nativeElement.querySelector('[data-testid="attendance-stats-box"]');
      expect(box).toBeTruthy();
      expect(box.textContent).toContain('Vindran');
      expect(box.textContent).toContain('No vindran');
      expect(box.textContent).toContain('Pendents');
      expect(box.textContent).not.toContain('Assistit');
      expect(box.textContent).toContain('2 xicalla');
    });

    it('links each tile to the filtered roll-call for that status', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([]), UserRole.TECHNICAL);
      const link = fixture.nativeElement.querySelector('a[href*="roll-call"][href*="status=ANIRE"]') as HTMLAnchorElement;
      expect(link).toBeTruthy();
    });

    it('shows "Assistit" for an assaig', async () => {
      fixture = await setup(
        of({ ...MOCK_DETAIL, eventType: EventType.ASSAIG }),
        of([]),
        UserRole.ADMIN,
      );
      const box = fixture.nativeElement.querySelector('[data-testid="attendance-stats-box"]');
      expect(box.textContent).toContain('Assistit');
    });
  });

  describe('own position summary', () => {
    it('renders the reduced summary for a single placement', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        {
          id: 'seg-1',
          name: 'Bloc 1',
          sortOrder: 0,
          instances: [],
          myPlacements: [{ nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana', figureMode: 'COMPLETA' }],
        },
      ]));

      const row = fixture.nativeElement.querySelector('a.segment-row') as HTMLElement;
      expect(row.textContent).toContain('Vent (C1) a Roscana');
    });

    it('uppercases only the position name via CSS, never the rest of the summary', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        {
          id: 'seg-1',
          name: 'Bloc 1',
          sortOrder: 0,
          instances: [],
          myPlacements: [{ nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana', figureMode: 'COMPLETA' }],
        },
      ]));

      const summary = fixture.nativeElement.querySelector('.own-position-summary') as HTMLElement;
      const uppercased = summary.querySelector('.uppercase') as HTMLElement;
      expect(uppercased.textContent).toBe('Vent');
      expect(summary.textContent).toBe('Vent (C1) a Roscana');
    });

    it('renders nothing extra when the caller holds no placement in the segment', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        { id: 'seg-1', name: 'Bloc 1', sortOrder: 0, instances: [], myPlacements: [] },
      ]));

      const row = fixture.nativeElement.querySelector('a.segment-row') as HTMLElement;
      expect(row.querySelector('.own-position-summary')).toBeNull();
    });

    it('renders the multiple-placements warning when the caller holds more than one', async () => {
      fixture = await setup(of(MOCK_DETAIL), of([
        {
          id: 'seg-1',
          name: 'Bloc 1',
          sortOrder: 0,
          instances: [],
          myPlacements: [
            { nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana', figureMode: 'COMPLETA' },
            { nodeLabel: 'Mans', cordon: 2, figureName: 'Roscana', figureMode: 'COMPLETA' },
          ],
        },
      ]));

      const row = fixture.nativeElement.querySelector('a.segment-row') as HTMLElement;
      expect(row.textContent).toContain("Sou en més d'un lloc alhora");
    });
  });
});
