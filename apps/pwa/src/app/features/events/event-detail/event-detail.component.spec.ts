import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ApplicationRef } from '@angular/core';
import { By } from '@angular/platform-browser';
import { of, throwError } from 'rxjs';
import { AttendanceStatus, DelegateType, EventType, MeEventDetail, MeSegment } from '@muixer/shared';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceButtonComponent } from '../components/attendance-button/attendance-button.component';
import { EventService } from '../services/event.service';
import { ToastService } from '../../../shared/services/toast.service';
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
  };

  async function setup(findOneReturn = of(MOCK_DETAIL), findSegmentsReturn = of<MeSegment[]>([])) {
    eventService = {
      findOne: vi.fn().mockReturnValue(findOneReturn),
      updateAttendance: vi.fn(),
      findSegments: vi.fn().mockReturnValue(findSegmentsReturn),
    };

    await TestBed.configureTestingModule({
      imports: [TestHostComponent],
      providers: [
        provideRouter([]),
        { provide: EventService, useValue: eventService },
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
