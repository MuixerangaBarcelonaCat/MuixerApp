import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { ToastService } from '@muixer/ui';
import { AttendanceListComponent } from './attendance-list.component';
import { AttendanceStatus, AttendanceSummary, EventPhase } from '@muixer/shared';
import { AttendanceItem } from '../../models/attendance.model';
import { AttendanceService } from '../../services/attendance.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

/** Pure-unit tests for the badge colour helper. No TestBed needed — `phase` is stubbed. */
describe('AttendanceListComponent — getStatusBadgeVariant', () => {
  const withPhase = (phase: EventPhase) => {
    const component = Object.create(AttendanceListComponent.prototype) as AttendanceListComponent;
    (component as unknown as { phase: () => EventPhase }).phase = () => phase;
    return component;
  };

  it.each([
    [AttendanceStatus.PENDENT, 'ghost'],
    [AttendanceStatus.ANIRE, 'success'],
    [AttendanceStatus.NO_VAIG, 'error'],
    [AttendanceStatus.ASSISTIT, 'success'],
  ] as const)('before the event: %s → "%s"', (status, expected) => {
    expect(withPhase('before').getStatusBadgeVariant(status)).toBe(expected);
  });

  it.each(['day', 'after'] as const)('ANIRE (not arrived) is a warning from the event day on (%s)', (phase) => {
    expect(withPhase(phase).getStatusBadgeVariant(AttendanceStatus.ANIRE)).toBe('warning');
  });
});

describe('AttendanceListComponent — navigateToPerson', () => {
  it('navigates to /persons/:id', () => {
    const comp = Object.create(AttendanceListComponent.prototype) as AttendanceListComponent;
    const navigateMock = vi.fn();
    (comp as unknown as { router: unknown }).router = { navigate: navigateMock };
    comp.navigateToPerson('person-123');
    expect(navigateMock).toHaveBeenCalledWith(['/persons', 'person-123']);
  });
});

const EVENT_ID = 'event-1';

const makeItem = (overrides: Partial<AttendanceItem> = {}, personOverrides: Partial<AttendanceItem['person']> = {}): AttendanceItem => ({
  status: AttendanceStatus.PENDENT,
  respondedAt: null,
  notes: null,
  ...overrides,
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
    ...personOverrides,
  },
});

const SUMMARY: AttendanceSummary = {
  confirmed: 48, declined: 9, pending: 155, attended: 3,
  lateCancel: 0, children: 0, childrenAttended: 0, total: 215,
};

interface SetupOptions {
  items?: AttendanceItem[];
  phase?: EventPhase;
  summary?: AttendanceSummary | null;
  cardMode?: boolean;
}

/** Builds the list with a stubbed AttendanceService/ToastService; `set` echoes the requested status. */
const setup = async ({ items = [makeItem()], phase = 'before', summary = SUMMARY, cardMode = false }: SetupOptions = {}) => {
  const originalMatchMedia = window.matchMedia;
  if (cardMode) {
    window.matchMedia = vi.fn().mockImplementation((query: string) => ({
      matches: true, media: query, onchange: null,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia;
  }

  const getByEvent = vi.fn().mockReturnValue(of({ data: items, meta: { total: items.length, page: 1, limit: 100 } }));
  const set = vi.fn((_: string, personId: string, payload: { status: AttendanceStatus }) => {
    const item = items.find((i) => i.person.id === personId) ?? makeItem();
    return of({
      attendance: { ...item, status: payload.status, respondedAt: '2026-10-02T10:00:00Z' },
      summary: SUMMARY,
    });
  });
  const toast = { success: vi.fn(), error: vi.fn() };

  await TestBed.configureTestingModule({
    imports: [AttendanceListComponent],
    providers: [
      provideRouter([]),
      allLucideIconsProvider,
      { provide: AttendanceService, useValue: { getByEvent, set } },
      { provide: ToastService, useValue: toast },
    ],
  }).compileComponents();

  const fixture = TestBed.createComponent(AttendanceListComponent);
  fixture.componentRef.setInput('eventId', EVENT_ID);
  fixture.componentRef.setInput('phase', phase);
  fixture.componentRef.setInput('summary', summary);
  fixture.detectChanges();
  window.matchMedia = originalMatchMedia;

  const el = fixture.nativeElement as HTMLElement;
  const statusButtons = (scope: ParentNode = el) =>
    Array.from(scope.querySelectorAll('[data-testid="attendance-status"] button')) as HTMLButtonElement[];

  return { fixture, component: fixture.componentInstance, el, getByEvent, set, toast, statusButtons };
};

describe('AttendanceListComponent — default filter', () => {
  it.each(['before', 'day', 'after'] as const)('lists everyone by default (%s)', async (phase) => {
    const { getByEvent } = await setup({ phase });
    expect(getByEvent).toHaveBeenCalledWith(EVENT_ID, expect.objectContaining({ status: undefined }));
  });

  it('shows a count per option of the status dropdown, from the summary', async () => {
    const { el } = await setup();
    const options = Array.from(el.querySelectorAll('select option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Tots (215)', 'Ve (48)', 'Assistit (3)', 'No ve (9)', 'Pendents (155)']);
  });

  it('labels the dropdown options for a past event', async () => {
    const { el } = await setup({ phase: 'after' });
    const options = Array.from(el.querySelectorAll('select option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Tots (215)', 'No presentat (48)', 'Va vindre (3)', 'No va vindre (9)', 'Sense resposta (155)']);
  });

  it('labels the dropdown options on the event day', async () => {
    const { el } = await setup({ phase: 'day' });
    const options = Array.from(el.querySelectorAll('select option')).map((o) => o.textContent?.trim());
    expect(options).toEqual(['Tots (215)', 'No ha arribat (48)', 'Ha arribat (3)', 'No vindrà (9)', 'Pendents (155)']);
  });

  it('resets the status filter when a search starts, so a search covers everyone', async () => {
    vi.useFakeTimers();
    try {
      const { component, getByEvent } = await setup();
      component.onAttendanceStatusFilter(AttendanceStatus.ANIRE);
      getByEvent.mockClear();

      component.onAttendanceSearchChange('joa');
      vi.advanceTimersByTime(300);

      expect(component.attendanceStatusFilter()).toBeUndefined();
      expect(getByEvent).toHaveBeenCalledWith(EVENT_ID, expect.objectContaining({ status: undefined, search: 'joa' }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('AttendanceListComponent — inline status', () => {
  it('offers Ve / No ve before the event starts (Pendent is not a button)', async () => {
    const { statusButtons } = await setup({ phase: 'before' });
    expect(statusButtons().map((b) => b.textContent?.trim())).toEqual(['Ve', 'No ve']);
  });

  it('shows no active button for a PENDENT person', async () => {
    const { statusButtons } = await setup({ items: [makeItem({ status: AttendanceStatus.PENDENT })] });
    expect(statusButtons().filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual([]);
  });

  it('offers Ha arribat / No ha arribat / No vindrà on the event day', async () => {
    const { statusButtons } = await setup({ phase: 'day' });
    expect(statusButtons().map((b) => b.textContent?.trim())).toEqual(['Ha arribat', 'No ha arribat', 'No vindrà']);
  });

  it('shows a read-only badge instead of buttons after the event day', async () => {
    const { el, statusButtons } = await setup({ phase: 'after', items: [makeItem({ status: AttendanceStatus.ASSISTIT })] });
    expect(statusButtons()).toEqual([]);
    const badge = el.querySelector('[data-testid="attendance-status"] lib-badge') as HTMLElement;
    expect(badge.textContent?.trim()).toBe('Va vindre');
    expect(el.querySelector('[data-testid="attendance-status"] button')).toBeNull();
  });

  it.each([
    [AttendanceStatus.ANIRE, 'No presentat'],
    [AttendanceStatus.NO_VAIG, 'No va vindre'],
    [AttendanceStatus.PENDENT, 'Sense resposta'],
  ] as const)('after the event day, a %s person reads "%s"', async (status, label) => {
    const { el } = await setup({ phase: 'after', items: [makeItem({ status })] });
    expect((el.querySelector('[data-testid="attendance-status"]') as HTMLElement).textContent?.trim()).toBe(label);
  });

  it('marks the current status as the active button', async () => {
    const { statusButtons } = await setup({ items: [makeItem({ status: AttendanceStatus.NO_VAIG })] });
    const active = statusButtons().filter((b) => b.getAttribute('aria-pressed') === 'true');
    expect(active.map((b) => b.textContent?.trim())).toEqual(['No ve']);
  });

  it('sets the status with one click, keyed by person, and updates the row and the summary', async () => {
    const { component, set, statusButtons, fixture } = await setup();
    const emitted: AttendanceSummary[] = [];
    component.summaryChanged.subscribe((s) => emitted.push(s));

    statusButtons()[0].click(); // Ve
    fixture.detectChanges();

    expect(set).toHaveBeenCalledWith(EVENT_ID, 'person-1', { status: AttendanceStatus.ANIRE });
    expect(component.attendances()[0].status).toBe(AttendanceStatus.ANIRE);
    expect(emitted).toEqual([SUMMARY]);
  });

  it('sets the person back to PENDENT when the active status is clicked again', async () => {
    const { component, set, statusButtons } = await setup({ items: [makeItem({ status: AttendanceStatus.ANIRE })] });
    statusButtons()[0].click();
    expect(set).toHaveBeenCalledWith(EVENT_ID, 'person-1', { status: AttendanceStatus.PENDENT });
    expect(component.attendances()[0].status).toBe(AttendanceStatus.PENDENT);
  });

  it('also toggles back to PENDENT on the event day', async () => {
    const { set, statusButtons } = await setup({ phase: 'day', items: [makeItem({ status: AttendanceStatus.ASSISTIT })] });
    statusButtons()[0].click();
    expect(set).toHaveBeenCalledWith(EVENT_ID, 'person-1', { status: AttendanceStatus.PENDENT });
  });

  it('keeps a changed row visible under the current filter (no reload)', async () => {
    const { component, getByEvent } = await setup();
    getByEvent.mockClear();
    component.setStatus(component.attendances()[0], AttendanceStatus.ANIRE);
    expect(getByEvent).not.toHaveBeenCalled();
    expect(component.attendances()).toHaveLength(1);
  });

  it('reverts the row and shows the server message when saving fails', async () => {
    const { component, set, toast } = await setup();
    set.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 400, error: { message: 'Error del servidor' } })));

    component.setStatus(component.attendances()[0], AttendanceStatus.ANIRE);

    expect(component.attendances()[0].status).toBe(AttendanceStatus.PENDENT);
    expect(toast.error).toHaveBeenCalledWith('Error del servidor');
  });

  it('falls back to a generic message when the error has none', async () => {
    const { component, set, toast } = await setup();
    set.mockReturnValueOnce(throwError(() => new Error('network')));
    component.setStatus(component.attendances()[0], AttendanceStatus.ANIRE);
    expect(toast.error).toHaveBeenCalledWith("No s'ha pogut actualitzar l'assistència");
  });

  it('shows the server message when the event is locked (403)', async () => {
    const { component, set, toast } = await setup({ phase: 'day' });
    set.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Este event està fora del marge per canviar assistència.' } })),
    );
    component.setStatus(component.attendances()[0], AttendanceStatus.ASSISTIT);
    expect(component.attendances()[0].status).toBe(AttendanceStatus.PENDENT);
    expect(toast.error).toHaveBeenCalledWith('Este event està fora del marge per canviar assistència.');
  });
});

describe('AttendanceListComponent — rendering', () => {
  it('renders a table in desktop mode, without Etiquetes or Resposta columns', async () => {
    const { el } = await setup();
    expect(el.querySelector('table.table')).toBeTruthy();
    const headers = Array.from(el.querySelectorAll('thead th')).map((th) => th.textContent?.trim());
    expect(headers).not.toContain('Etiquetes');
    expect(headers).not.toContain('Resposta');
  });

  it('has no Pinyes/Troncs toggle', async () => {
    const { el } = await setup();
    expect(el.textContent).not.toContain('Pinyes');
    expect(el.textContent).not.toContain('Troncs');
  });

  it('shows when the person answered as the tooltip of the status control', async () => {
    const { el } = await setup({ items: [makeItem({ status: AttendanceStatus.ANIRE, respondedAt: '2026-09-30T18:05:00Z' })] });
    const control = el.querySelector('[data-testid="attendance-status"]') as HTMLElement;
    expect(control.getAttribute('title')).toContain('30/09/2026');
  });

  it('gives the alias/name links a real >=24px tap target', async () => {
    const { el } = await setup();
    const links = Array.from(el.querySelectorAll('table.table .link')) as HTMLElement[];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.className).toContain('min-h-6');
      expect(link.className).toContain('inline-flex');
    }
  });

  it('gives the attendance search input a >=24px tap target (WI-22)', async () => {
    const { el } = await setup();
    const search = el.querySelector('input[type="text"]') as HTMLElement;
    expect(search.className).toContain('h-6');
  });

  it('renders cards with the same inline status control below lg', async () => {
    const { el, statusButtons } = await setup({ cardMode: true });
    expect(el.querySelector('table.table')).toBeFalsy();
    const card = el.querySelector('[data-testid="attendance-card"]') as HTMLElement;
    expect(card.textContent).toContain('PERSIANA');
    expect(statusButtons(card)).toHaveLength(2);
  });

  it('flags a provisional attendee with a "Prov." badge', async () => {
    const { el } = await setup({ items: [makeItem({}, { alias: '~walkin', isProvisional: true })] });
    expect(el.textContent).toContain('Prov.');
  });
});

describe('AttendanceListComponent — notes', () => {
  it('puts the notes button right after the status buttons, in the same cell', async () => {
    const { el } = await setup();
    const row = el.querySelector('[data-testid="attendance-row-actions"]') as HTMLElement;
    const children = Array.from(row.children).map((c) => c.getAttribute('data-testid'));
    expect(children).toEqual(['attendance-status', 'attendance-notes']);
  });

  it('does the same in card mode', async () => {
    const { el } = await setup({ cardMode: true });
    const card = el.querySelector('[data-testid="attendance-card"]') as HTMLElement;
    const row = card.querySelector('[data-testid="attendance-row-actions"]') as HTMLElement;
    expect(Array.from(row.children).map((c) => c.getAttribute('data-testid'))).toEqual([
      'attendance-status',
      'attendance-notes',
    ]);
  });

  it('opens the notes modal from the row notes button', async () => {
    const { el, component, fixture } = await setup();
    (el.querySelector('[data-testid="attendance-notes"] button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.editingAttendance()?.person.id).toBe('person-1');
  });

  it('replaces the saved row by person id and emits the summary', async () => {
    const { component } = await setup();
    const emitted: AttendanceSummary[] = [];
    component.summaryChanged.subscribe((s) => emitted.push(s));

    const updated = makeItem({ notes: 'Lesionada' });
    component.onAttendanceSaved({ attendance: updated, summary: SUMMARY });

    expect(component.attendances()).toEqual([updated]);
    expect(emitted).toEqual([SUMMARY]);
  });

  it('confirms the save with a pronominal-passive message', async () => {
    const { component, toast } = await setup();
    component.onAttendanceSaved({ attendance: makeItem({ notes: 'Lesionada' }), summary: SUMMARY });
    expect(toast.success).toHaveBeenCalledWith("S'han alçat les notes.");
  });
});
