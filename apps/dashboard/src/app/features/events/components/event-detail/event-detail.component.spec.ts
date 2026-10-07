import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { ToastService } from '@muixer/ui';
import { EventDetailComponent } from './event-detail.component';
import { AttendanceStatus, EventPhase, EventType, UserRole } from '@muixer/shared';
import { AttendanceSummary, EventDetail } from '../../models/event.model';
import { AttendanceItem } from '../../models/attendance.model';
import { EventService } from '../../services/event.service';
import { AttendanceService } from '../../services/attendance.service';
import { ParticipationService } from '../../services/participation.service';
import { SeasonService } from '../../services/season.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

/**
 * Pure-unit tests for EventDetailComponent helper methods.
 * No Angular TestBed needed — the methods under test are stateless logic.
 */
describe('EventDetailComponent — getSummaryForDisplay', () => {
  let component: Pick<EventDetailComponent, 'getSummaryForDisplay' | 'isPast' | 'phase' | 'formatDate'>;

  const stub = (phase: EventPhase, isPast: boolean) => {
    (component as unknown as { phase: () => EventPhase }).phase = () => phase;
    (component as unknown as { isPast: () => boolean }).isPast = () => isPast;
  };

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

  describe('after the event day', () => {
    beforeEach(() => stub('after', true));

    it('labels the rows Va vindre / No presentat / No va vindre / Sense resposta', () => {
      const labels = component.getSummaryForDisplay(pastSummary).map((r) => r.label);
      expect(labels.slice(0, 5)).toEqual(['Va vindre', 'No presentat', 'No va vindre', 'Baixes tardanes', 'Sense resposta']);
    });

    it('includes Va vindre row with attended value', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      const row = rows.find((r) => r.label === 'Va vindre');
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

  describe('on the event day', () => {
    beforeEach(() => stub('day', true));

    it('labels the rows Ha arribat / No ha arribat / No vindrà / Pendents, with their values', () => {
      const rows = component.getSummaryForDisplay(pastSummary);
      expect(rows.slice(0, 5).map((r) => [r.label, r.value])).toEqual([
        ['Ha arribat', 55],
        ['No ha arribat', 3],
        ['No vindrà', 15],
        ['Baixes tardanes', 2],
        ['Pendents', 8],
      ]);
    });
  });

  describe('before the event day', () => {
    beforeEach(() => stub('before', false));

    it('labels the rows Ve / No ve / Pendents', () => {
      const labels = component.getSummaryForDisplay(futureSummary).map((r) => r.label);
      expect(labels.slice(0, 3)).toEqual(['Ve', 'No ve', 'Pendents']);
    });

    it('includes Ve row with confirmed value', () => {
      const rows = component.getSummaryForDisplay(futureSummary);
      const row = rows.find((r) => r.label === 'Ve');
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
    beforeEach(() => stub('before', false));

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
    notes: null,
    metadata: {},
    isSynced: false,
  };

  const attendance: AttendanceItem = {
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

  let downloadSummaryPdf: ReturnType<typeof vi.fn>;
  const seasonService = { getAll: vi.fn(() => of({ data: [] })) };

  beforeEach(() => {
    downloadSummaryPdf = vi.fn();
  });

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
        { provide: EventService, useValue: { getOne: () => of({ ...event, ...eventOverrides }), downloadSummaryPdf } },
        { provide: AttendanceService, useValue: { getByEvent: () => of({ data: [attendance], meta: { total: 1, page: 1, limit: 100 } }) } },
        {
          provide: ParticipationService,
          useValue: {
            getByEvent: () =>
              of({
                event: { id: EVENT_ID, title: 'Assaig general', date: '2026-07-22' },
                segments: [],
                persons: [],
                meta: {
                  distinctPersons: 0,
                  personsWithPlacement: 0,
                  totalPlacements: 0,
                  conflictedPersons: 0,
                },
              }),
          },
        },
        { provide: SeasonService, useValue: seasonService },
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

  it("doesn't load seasons itself: the edit modal derives the season from the date", async () => {
    seasonService.getAll.mockClear();
    await setup();
    expect(seasonService.getAll).not.toHaveBeenCalled();
  });

  describe('notes panel', () => {
    it('renders the notes panel above the tabs', async () => {
      const fixture = await setup();
      const notesPanel = fixture.nativeElement.querySelector('app-event-notes-panel') as HTMLElement;
      const tabs = fixture.nativeElement.querySelector('lib-tabs') as HTMLElement;

      expect(notesPanel).toBeTruthy();
      expect(notesPanel.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('keeps the page state in sync when the panel saves, without refetching', async () => {
      const fixture = await setup({ notes: 'Antic' });

      fixture.componentInstance.onNotesSaved('Nou');
      fixture.detectChanges();

      expect(fixture.componentInstance.event()!.notes).toBe('Nou');
    });
  });

  describe('default tab', () => {
    it('opens on Pinyes i Figures', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
      expect(panel(fixture, 'pinyes')!.className).not.toContain('hidden');
      expect(fixture.nativeElement.querySelector('app-segment-manager')).toBeTruthy();
    });

    it('does not mount the Assistència or Participació sections until they are opened', async () => {
      const fixture = await setup();
      expect(panel(fixture, 'assistencia')).toBeNull();
      expect(panel(fixture, 'participacio')).toBeNull();
      expect(fixture.nativeElement.querySelector('app-attendance-list')).toBeFalsy();
      expect(fixture.nativeElement.querySelector('app-event-participation')).toBeFalsy();
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

    it('labels the main stat card with the phase label ("Va vindre" after the event day)', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-23T10:00:00Z'));
      try {
        const fixture = await setup();
        const card = fixture.nativeElement.querySelector('app-stat-card') as HTMLElement;
        expect(card.textContent).toContain('Va vindre');
      } finally {
        vi.useRealTimers();
      }
    });

    it('passes the event phase to the segment manager and the participation matrix', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-22T10:00:00Z'));
      try {
        const fixture = await setup();
        const manager = fixture.debugElement.query((de) => de.name === 'app-segment-manager');
        expect(manager.componentInstance.phase()).toBe('day');
        clickTab(fixture, 'participacio');
        const matrix = fixture.debugElement.query((de) => de.name === 'app-event-participation');
        expect(matrix.componentInstance.phase()).toBe('day');
      } finally {
        vi.useRealTimers();
      }
    });

    it('passes the event phase to the attendance list (an event on 22/07/2026, seen later, is "after")', async () => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date('2026-07-23T10:00:00Z'));
      try {
        const fixture = await setup();
        clickTab(fixture, 'assistencia');
        const list = fixture.debugElement.query((de) => de.name === 'app-attendance-list');
        expect(list.componentInstance.phase()).toBe('after');
      } finally {
        vi.useRealTimers();
      }
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

  describe('Participació tab', () => {
    it('mounts the participation matrix when opened', async () => {
      const fixture = await setup();
      clickTab(fixture, 'participacio');

      expect(fixture.componentInstance.activeTab()).toBe('participacio');
      expect(fixture.nativeElement.querySelector('app-event-participation')).toBeTruthy();
      expect(panel(fixture, 'participacio')!.className).not.toContain('hidden');
      expect(panel(fixture, 'resum')!.className).toContain('hidden');
    });

    it('stays mounted after a round trip so its filters survive', async () => {
      const fixture = await setup();
      clickTab(fixture, 'participacio');
      clickTab(fixture, 'resum');

      expect(panel(fixture, 'participacio')).toBeTruthy();
      expect(panel(fixture, 'participacio')!.className).toContain('hidden');
    });

    it('opens directly from ?tab=participacio', async () => {
      const fixture = await setup({}, { tab: 'participacio' });

      expect(fixture.componentInstance.activeTab()).toBe('participacio');
      expect(panel(fixture, 'participacio')!.className).not.toContain('hidden');
    });
  });

  describe('deep link via ?tab=', () => {
    it('opens the requested tab on load', async () => {
      const fixture = await setup({}, { tab: 'assistencia' });
      expect(fixture.componentInstance.activeTab()).toBe('assistencia');
      expect(panel(fixture, 'assistencia')!.className).not.toContain('hidden');
      expect(panel(fixture, 'resum')!.className).toContain('hidden');
    });

    it('falls back to Pinyes i Figures on an unknown tab value', async () => {
      const fixture = await setup({}, { tab: 'nonsense' });
      expect(fixture.componentInstance.activeTab()).toBe('pinyes');
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

  describe('Imprimeix', () => {
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };

    beforeEach(() => {
      URL.createObjectURL = vi.fn().mockReturnValue('blob:fake');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = original.create;
      URL.revokeObjectURL = original.revoke;
      vi.restoreAllMocks();
    });

    const printButton = (fixture: ComponentFixture<EventDetailComponent>) =>
      fixture.nativeElement.querySelector('[data-testid="event-print"] button') as HTMLButtonElement;

    it('downloads the event summary PDF under the filename the API proposes', async () => {
      const blob = new Blob(['%PDF-']);
      downloadSummaryPdf.mockReturnValue(of({ blob, filename: '2026-07-22-assaig-general.pdf' }));
      const downloads: string[] = [];
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
      const fixture = await setup();

      printButton(fixture).click();

      expect(downloadSummaryPdf).toHaveBeenCalledWith(EVENT_ID);
      expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
      expect(downloads).toEqual(['2026-07-22-assaig-general.pdf']);
    });

    it('shows a loading state and ignores clicks while the PDF is being generated', async () => {
      const response = new Subject<{ blob: Blob; filename: string }>();
      downloadSummaryPdf.mockReturnValue(response);
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
      const fixture = await setup();

      fixture.componentInstance.printSummary();
      fixture.detectChanges();
      fixture.componentInstance.printSummary();

      expect(fixture.componentInstance.printing()).toBe(true);
      expect(printButton(fixture).disabled).toBe(true);
      expect(downloadSummaryPdf).toHaveBeenCalledTimes(1);

      response.next({ blob: new Blob(), filename: 'a.pdf' });
      response.complete();
      expect(fixture.componentInstance.printing()).toBe(false);
    });

    it('shows an error toast when the PDF cannot be generated', async () => {
      downloadSummaryPdf.mockReturnValue(throwError(() => new Error('500')));
      const fixture = await setup();
      const toastError = vi.spyOn(TestBed.inject(ToastService), 'error');

      fixture.componentInstance.printSummary();

      expect(toastError).toHaveBeenCalledWith("No s'ha pogut generar el PDF. Torneu a provar-ho més tard.");
      expect(fixture.componentInstance.printing()).toBe(false);
    });
  });
});
