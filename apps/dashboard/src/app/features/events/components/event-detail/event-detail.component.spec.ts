import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceStatus, EventType, UserRole } from '@muixer/shared';
import { AttendanceSummary, EventDetail } from '../../models/event.model';
import { AttendanceItem } from '../../models/attendance.model';
import { EventService } from '../../services/event.service';
import { AttendanceService } from '../../services/attendance.service';
import { SeasonService } from '../../services/season.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

/**
 * Pure-unit tests for EventDetailComponent helper methods.
 * No Angular TestBed needed — the methods under test are stateless logic.
 */
describe('EventDetailComponent — getSummaryForDisplay', () => {
  let component: Pick<
    EventDetailComponent,
    'getSummaryForDisplay' | 'isPast' | 'getStatusLabel' | 'getStatusBadgeClass' | 'formatDate' | 'formatDateTime'
  >;

  const pastSummary: AttendanceSummary = {
    confirmed: 3,     // ANIRE count (no-shows)
    declined: 15,
    pending: 8,
    attended: 55,
    lateCancel: 2,
    children: 5,
    childrenAttended: 3,
    total: 81,
  };

  const futureSummary: AttendanceSummary = {
    confirmed: 30,
    declined: 10,
    pending: 20,
    attended: 0,
    lateCancel: 0,
    children: 4,
    childrenAttended: 0,
    total: 60,
  };

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('past event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it('includes Assistit row with attended value', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Assistit');
      expect(row).toBeDefined();
      expect(row!.value).toBe(55);
    });

    it('includes No presentat row with confirmed (ANIRE) count', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'No presentat');
      expect(row).toBeDefined();
      expect(row!.value).toBe(3); // pastSummary.confirmed = 3
    });

    it('shows lateCancel row when lateCancel > 0', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Baixes tardanes');
      expect(row).toBeDefined();
      expect(row!.value).toBe(2);
    });

    it('hides lateCancel row when lateCancel === 0', () => {
      const summary = { ...pastSummary, lateCancel: 0 };
      const rows = component.getSummaryForDisplay(summary);
      expect(rows.find((r) => r.label === 'Baixes tardanes')).toBeUndefined();
    });

    it('shows Total row', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Total');
      expect(row).toBeDefined();
      expect(row!.value).toBe(81);
    });

    it('includes Adults row with correct value (attended - children)', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Adults');
      expect(row).toBeDefined();
      expect(row!.value).toBe(50);
    });
  });

  describe('future event', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('includes Aniré row with confirmed value', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const row = rows.find((r) => r.label === 'Aniré');
      expect(row).toBeDefined();
      expect(row!.value).toBe(30);
    });

    it('does not include No presentat row', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      expect(rows.find((r) => r.label === 'No presentat')).toBeUndefined();
    });

    it('does not include Baixes tardanes row', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      expect(rows.find((r) => r.label === 'Baixes tardanes')).toBeUndefined();
    });

    it('includes Adults row with correct value (confirmed - children)', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const row = rows.find((r) => r.label === 'Adults');
      expect(row).toBeDefined();
      expect(row!.value).toBe(26);
    });
  });

  describe('icon fields use Lucide names (not emojis)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('all rows have icon as a Lucide icon name string', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const validIcons = ['UserCheck', 'UserMinus', 'Users', 'UserX', 'AlertCircle', 'Clock', 'Baby', 'UsersRound'];
      for (const row of rows) {
        expect(validIcons).toContain(row.icon);
      }
    });

    it('all rows have an iconClass string', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      for (const row of rows) {
        expect(row.iconClass).toBeDefined();
        expect(typeof row.iconClass).toBe('string');
      }
    });
  });
});

describe('EventDetailComponent — getStatusLabel', () => {
  let component: Pick<EventDetailComponent, 'getStatusLabel' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('past event labels', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it.each([
      [AttendanceStatus.PENDENT, 'Sense resposta'],
      [AttendanceStatus.ANIRE, 'No presentat'],
      [AttendanceStatus.NO_VAIG, 'No va anar'],
      [AttendanceStatus.ASSISTIT, 'Assistit'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.getStatusLabel(status)).toBe(expected);
    });
  });

  describe('future event labels', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it('NO_VAIG → "No vaig" for future event', () => {
      expect(component.getStatusLabel(AttendanceStatus.NO_VAIG)).toBe('No vaig');
    });
  });
});

describe('EventDetailComponent — getStatusBadgeClass', () => {
  let component: Pick<EventDetailComponent, 'getStatusBadgeClass' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
  });

  describe('future event (isPast=false)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => false;
    });

    it.each([
      [AttendanceStatus.PENDENT, 'badge-ghost'],
      [AttendanceStatus.ANIRE, 'badge-success'],
      [AttendanceStatus.NO_VAIG, 'badge-error'],
      [AttendanceStatus.ASSISTIT, 'badge-success'],
    ] as const)('%s → "%s"', (status, expected) => {
      expect(component.getStatusBadgeClass(status)).toBe(expected);
    });
  });

  describe('past event (isPast=true)', () => {
    beforeEach(() => {
      (component as unknown as { isPast: () => boolean }).isPast = () => true;
    });

    it('ANIRE → badge-warning for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.ANIRE)).toBe('badge-warning');
    });

    it('ASSISTIT → badge-success for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.ASSISTIT)).toBe('badge-success');
    });

    it('NO_VAIG → badge-error for past event', () => {
      expect(component.getStatusBadgeClass(AttendanceStatus.NO_VAIG)).toBe('badge-error');
    });
  });
});

describe('EventDetailComponent — navigateToPerson', () => {
  it('navigates to /persons/:id', () => {
    const comp = Object.create(EventDetailComponent.prototype) as EventDetailComponent;
    const navigateMock = vi.fn();
    (comp as unknown as { router: unknown }).router = { navigate: navigateMock };
    comp.navigateToPerson('person-123');
    expect(navigateMock).toHaveBeenCalledWith(['/persons', 'person-123']);
  });
});

describe('EventDetailComponent — attendance card mode on mobile (WI-08, EV-M2)', () => {
  const EVENT_ID = 'event-1';

  const event: EventDetail = {
    id: EVENT_ID,
    eventType: EventType.ASSAIG,
    title: 'Assaig general',
    date: '2026-07-22',
    startTime: '18:00',
    location: null,
    countsForStatistics: true,
    attendanceSummary: { confirmed: 0, declined: 0, pending: 0, attended: 0, lateCancel: 0, children: 0, childrenAttended: 0, total: 0 },
    season: null,
    segmentsSummary: null,
    createdAt: '2026-01-01',
    description: null,
    locationUrl: null,
    information: null,
    metadata: {},
    isSynced: false,
  };

  const attendance: AttendanceItem = {
    id: 'att-1',
    status: AttendanceStatus.ANIRE,
    respondedAt: null,
    notes: null,
    person: {
      id: 'person-1',
      alias: 'PERSIANA',
      name: 'Joana',
      firstSurname: 'Vila',
      isXicalla: false,
      isProvisional: false,
      notes: null,
      notesEmoji: null,
      positions: [],
    },
  };

  const setup = async (
    eventOverrides: Partial<EventDetail> = {},
  ): Promise<ComponentFixture<EventDetailComponent>> => {
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ id: EVENT_ID }) } } },
        { provide: EventService, useValue: { getOne: () => of({ ...event, ...eventOverrides }) } },
        { provide: AttendanceService, useValue: { getByEvent: () => of({ data: [attendance], meta: { total: 1, page: 1, limit: 100 } }) } },
        { provide: SeasonService, useValue: { getAll: () => of({ data: [] }) } },
        { provide: AuthService, useValue: { userRole: () => UserRole.ADMIN } },
        {
          provide: NodeAssignmentService,
          useValue: {
            getLockStatus: () => of({ locked: false, lockDate: null, lockDays: 3 }),
            getEventAssignmentSummary: () => of({ segments: [] }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(EventDetailComponent);
    fixture.detectChanges();
    return fixture;
  };

  describe('table mode (default, no matchMedia)', () => {
    it('renders the attendance table, not cards', async () => {
      const fixture = await setup();
      expect(fixture.nativeElement.querySelector('table.table')).toBeTruthy();
      expect(fixture.nativeElement.querySelector('[data-testid="attendance-card"]')).toBeFalsy();
    });
  });

  describe('tap targets >=24px (WI-03, EV-M3)', () => {
    it('gives the attendance status badge a >=24px tap target', async () => {
      const fixture = await setup();
      const badge = fixture.nativeElement.querySelector('table.table .badge.cursor-pointer') as HTMLElement;
      expect(badge.className).toContain('min-h-6');
    });

    it('gives the alias/name links a real >=24px tap target instead of the bare glyph height', async () => {
      const fixture = await setup();
      const links = Array.from(fixture.nativeElement.querySelectorAll('table.table .link')) as HTMLElement[];
      expect(links.length).toBeGreaterThan(0);
      for (const link of links) {
        expect(link.className).toContain('min-h-6');
        expect(link.className).toContain('inline-flex');
      }
    });

    it('gives the location link a real >=24px tap target instead of the bare glyph height', async () => {
      const fixture = await setup({ location: 'Casal', locationUrl: 'https://maps.example.com/casal' });
      const link = fixture.nativeElement.querySelector('a.link-primary') as HTMLElement;
      expect(link).toBeTruthy();
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    });
  });

  describe('card mode (< lg)', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: true,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('renders each attendance entry as a card instead of a table row', async () => {
      const fixture = await setup();
      expect(fixture.nativeElement.querySelector('table.table')).toBeFalsy();
      const cards = fixture.nativeElement.querySelectorAll('[data-testid="attendance-card"]');
      expect(cards.length).toBe(1);
      expect(cards[0].textContent).toContain('PERSIANA');
    });

    it('shows the status badge on the card, still clickable to open the edit modal', async () => {
      const fixture = await setup();
      const badge = fixture.nativeElement.querySelector('[data-testid="attendance-card"] .badge.cursor-pointer') as HTMLElement;
      expect(badge).toBeTruthy();
      expect(badge.textContent?.trim()).toBe(fixture.componentInstance.getStatusLabel(AttendanceStatus.ANIRE));
    });
  });
});
