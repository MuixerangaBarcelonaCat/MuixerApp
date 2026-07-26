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
  let component: Pick<EventDetailComponent, 'getSummaryForDisplay' | 'isPast' | 'formatDate'>;

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

describe('EventDetailComponent — tabbed sections', () => {
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
    queryParams: Record<string, string> = {},
  ): Promise<ComponentFixture<EventDetailComponent>> => {
    await TestBed.configureTestingModule({
      imports: [EventDetailComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: EVENT_ID }), queryParams } },
        },
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

  const clickTab = (fixture: ComponentFixture<EventDetailComponent>, tab: string) => {
    const button = fixture.nativeElement.querySelector(`[data-testid="event-tab-${tab}"]`) as HTMLElement;
    expect(button).toBeTruthy();
    button.click();
    fixture.detectChanges();
  };

  const panel = (fixture: ComponentFixture<EventDetailComponent>, tab: string): HTMLElement | null =>
    fixture.nativeElement.querySelector(`#event-tabpanel-${tab}`);

  describe('default tab', () => {
    it('opens on Resum with the event information visible', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.activeTab()).toBe('resum');
      expect(panel(fixture, 'resum')!.className).not.toContain('hidden');
      expect(fixture.nativeElement.textContent).toContain('Informació');
    });

    it('does not mount the Pinyes or Assistència sections until they are opened', async () => {
      const fixture = await setup();
      expect(panel(fixture, 'pinyes')).toBeNull();
      expect(panel(fixture, 'assistencia')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-attendance-list')).toBeFalsy();
    });

    it('gives the location link a real >=24px tap target instead of the bare glyph height', async () => {
      const fixture = await setup({ location: 'Casal', locationUrl: 'https://maps.example.com/casal' });
      const link = fixture.nativeElement.querySelector('a.link-primary') as HTMLElement;
      expect(link).toBeTruthy();
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    });
  });

  describe('switching tabs', () => {
    it('mounts the attendance list and hides the Resum panel', async () => {
      const fixture = await setup();
      clickTab(fixture, 'assistencia');

      expect(fixture.componentInstance.activeTab()).toBe('assistencia');
      expect(fixture.nativeElement.querySelector('app-attendance-list')).toBeTruthy();
      expect(panel(fixture, 'assistencia')!.className).not.toContain('hidden');
      expect(panel(fixture, 'resum')!.className).toContain('hidden');
    });

    it('keeps a visited tab mounted (hidden) so its filters survive a round trip', async () => {
      const fixture = await setup();
      clickTab(fixture, 'assistencia');
      clickTab(fixture, 'resum');

      expect(panel(fixture, 'assistencia')).toBeTruthy();
      expect(panel(fixture, 'assistencia')!.className).toContain('hidden');
      expect(panel(fixture, 'resum')!.className).not.toContain('hidden');
    });

    it('marks only the active tab as selected', async () => {
      const fixture = await setup();
      clickTab(fixture, 'assistencia');

      const selected = Array.from(
        fixture.nativeElement.querySelectorAll('[role="tab"][aria-selected="true"]'),
      ) as HTMLElement[];
      expect(selected.length).toBe(1);
      expect(selected[0].getAttribute('data-testid')).toBe('event-tab-assistencia');
    });
  });

  describe('deep link via ?tab=', () => {
    it('opens the requested tab on load', async () => {
      const fixture = await setup({}, { tab: 'assistencia' });
      expect(fixture.componentInstance.activeTab()).toBe('assistencia');
      expect(panel(fixture, 'assistencia')!.className).not.toContain('hidden');
      expect(panel(fixture, 'resum')!.className).toContain('hidden');
    });

    it('falls back to Resum on an unknown tab value', async () => {
      const fixture = await setup({}, { tab: 'nonsense' });
      expect(fixture.componentInstance.activeTab()).toBe('resum');
    });
  });

  describe('onSummaryChanged', () => {
    it('replaces the event attendance summary so the stat cards stay in sync', async () => {
      const fixture = await setup();
      // Same adults count (12 - 2) whether the event reads as past or future.
      fixture.componentInstance.onSummaryChanged({
        confirmed: 12, declined: 3, pending: 1, attended: 12,
        lateCancel: 0, children: 2, childrenAttended: 2, total: 16,
      });

      expect(fixture.componentInstance.event()!.attendanceSummary.confirmed).toBe(12);
      expect(fixture.componentInstance.adultsCount()).toBe(10);
    });
  });
});
