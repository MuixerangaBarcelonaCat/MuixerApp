import { vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AttendanceListComponent } from './attendance-list.component';
import { AttendanceStatus } from '@muixer/shared';
import { AttendanceItem } from '../../models/attendance.model';
import { AttendanceService } from '../../services/attendance.service';
import { allLucideIconsProvider } from '../../../../../testing/lucide-test-provider';

/**
 * Pure-unit tests for the stateless label/class helpers.
 * No TestBed needed — `isPast` is stubbed as a plain accessor.
 */
describe('AttendanceListComponent — getStatusLabel', () => {
  let component: Pick<AttendanceListComponent, 'getStatusLabel' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(AttendanceListComponent.prototype) as AttendanceListComponent;
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

describe('AttendanceListComponent — getStatusBadgeClass', () => {
  let component: Pick<AttendanceListComponent, 'getStatusBadgeClass' | 'isPast'>;

  beforeEach(() => {
    component = Object.create(AttendanceListComponent.prototype) as AttendanceListComponent;
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

describe('AttendanceListComponent — navigateToPerson', () => {
  it('navigates to /persons/:id', () => {
    const comp = Object.create(AttendanceListComponent.prototype) as AttendanceListComponent;
    const navigateMock = vi.fn();
    (comp as unknown as { router: unknown }).router = { navigate: navigateMock };
    comp.navigateToPerson('person-123');
    expect(navigateMock).toHaveBeenCalledWith(['/persons', 'person-123']);
  });
});

describe('AttendanceListComponent — rendering (WI-08, EV-M2)', () => {
  const EVENT_ID = 'event-1';

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

  const setup = async (): Promise<ComponentFixture<AttendanceListComponent>> => {
    await TestBed.configureTestingModule({
      imports: [AttendanceListComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: AttendanceService,
          useValue: { getByEvent: () => of({ data: [attendance], meta: { total: 1, page: 1, limit: 100 } }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceListComponent);
    fixture.componentRef.setInput('eventId', EVENT_ID);
    fixture.componentRef.setInput('isPast', false);
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

    it('gives the attendance search input a >=24px tap target (WI-22)', async () => {
      const fixture = await setup();
      const search = fixture.nativeElement.querySelector('input[type="text"]') as HTMLElement;
      expect(search).toBeTruthy();
      expect(search.className).toContain('h-6');
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

describe('AttendanceListComponent — summary propagation', () => {
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

  const summary = {
    confirmed: 1, declined: 0, pending: 0, attended: 0,
    lateCancel: 0, children: 0, childrenAttended: 0, total: 1,
  };

  const setup = async (): Promise<ComponentFixture<AttendanceListComponent>> => {
    await TestBed.configureTestingModule({
      imports: [AttendanceListComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        {
          provide: AttendanceService,
          useValue: { getByEvent: () => of({ data: [attendance], meta: { total: 1, page: 1, limit: 100 } }) },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceListComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.detectChanges();
    return fixture;
  };

  it('emits the recalculated summary when an attendance record is saved', async () => {
    const fixture = await setup();
    const emitted: unknown[] = [];
    fixture.componentInstance.summaryChanged.subscribe((s) => emitted.push(s));

    const updated: AttendanceItem = { ...attendance, status: AttendanceStatus.NO_VAIG };
    fixture.componentInstance.onAttendanceSaved({ attendance: updated, summary });

    expect(emitted).toEqual([summary]);
    expect(fixture.componentInstance.attendances()[0].status).toBe(AttendanceStatus.NO_VAIG);
  });

  it('emits the recalculated summary and drops the row when a record is deleted', async () => {
    const fixture = await setup();
    const emitted: unknown[] = [];
    fixture.componentInstance.summaryChanged.subscribe((s) => emitted.push(s));

    fixture.componentInstance.openAttendanceEdit(attendance);
    fixture.componentInstance.onAttendanceDeleted({ summary });

    expect(emitted).toEqual([summary]);
    expect(fixture.componentInstance.attendances()).toEqual([]);
    expect(fixture.componentInstance.totalAttendances()).toBe(0);
  });
});

describe('AttendanceListComponent — default status filter', () => {
  const setup = async (isPast: boolean) => {
    const getByEvent = vi.fn().mockReturnValue(of({ data: [], meta: { total: 0, page: 1, limit: 100 } }));

    await TestBed.configureTestingModule({
      imports: [AttendanceListComponent],
      providers: [
        provideRouter([]),
        allLucideIconsProvider,
        { provide: AttendanceService, useValue: { getByEvent } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AttendanceListComponent);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentRef.setInput('isPast', isPast);
    fixture.detectChanges();
    return { fixture, getByEvent };
  };

  it('filters by ANIRE on a future event', async () => {
    const { getByEvent } = await setup(false);
    expect(getByEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ status: AttendanceStatus.ANIRE }),
    );
  });

  it('filters by ASSISTIT on a past event', async () => {
    const { getByEvent } = await setup(true);
    expect(getByEvent).toHaveBeenCalledWith(
      'event-1',
      expect.objectContaining({ status: AttendanceStatus.ASSISTIT }),
    );
  });
});
