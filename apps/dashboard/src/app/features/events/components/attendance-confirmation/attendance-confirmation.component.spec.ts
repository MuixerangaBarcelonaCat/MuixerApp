import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { AttendanceConfirmationComponent } from './attendance-confirmation.component';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceItem } from '../../models/attendance.model';
import { AttendanceStatus } from '@muixer/shared';

const EVENT_ID = 'event-uuid-1';

const makePerson = (alias = 'Pepet'): AttendanceItem['person'] => ({
  id: 'person-1',
  alias,
  name: 'Pere',
  firstSurname: 'Garcia',
  isXicalla: false,
  notes: null,
  notesEmoji: null,
  positions: [],
});

const makeAttendance = (status: AttendanceStatus = AttendanceStatus.ANIRE): AttendanceItem => ({
  id: 'att-1',
  status,
  respondedAt: null,
  notes: null,
  person: makePerson(),
});

const makePaginatedResponse = (items: AttendanceItem[]) => ({
  data: items,
  meta: { total: items.length, page: 1, limit: 100 },
});

describe('AttendanceConfirmationComponent', () => {
  let fixture: ComponentFixture<AttendanceConfirmationComponent>;
  let component: AttendanceConfirmationComponent;
  let attendanceService: { getByEvent: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  let routerMock: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    attendanceService = {
      getByEvent: vi.fn().mockReturnValue(of(makePaginatedResponse([]))),
      update: vi.fn().mockReturnValue(of({ attendance: makeAttendance(), summary: {} })),
    };
    routerMock = { navigate: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AttendanceConfirmationComponent],
      providers: [
        { provide: AttendanceService, useValue: attendanceService },
        { provide: Router, useValue: routerMock },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: { get: () => EVENT_ID } } },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceConfirmationComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => vi.clearAllMocks());

  // ── initialization ────────────────────────────────────────────────────────

  it('creates successfully', () => {
    expect(component).toBeTruthy();
  });

  it('starts with empty query and no results', () => {
    expect(component.query()).toBe('');
    expect(component.results()).toHaveLength(0);
    expect(component.loading()).toBe(false);
  });

  // ── onKey ────────────────────────────────────────────────────────────────

  describe('onKey', () => {
    it('appends character to query', () => {
      component.onKey('A');
      expect(component.query()).toBe('A');
    });

    it('backspace removes last character', () => {
      component.onKey('A');
      component.onKey('B');
      component.onKey('⌫');
      expect(component.query()).toBe('A');
    });

    it('backspace on empty query keeps empty', () => {
      component.onKey('⌫');
      expect(component.query()).toBe('');
    });

    it('does not call service when query is 1 char', () => {
      component.onKey('A');
      expect(attendanceService.getByEvent).not.toHaveBeenCalled();
    });

    it('calls service when query reaches 2 chars', () => {
      component.onKey('A');
      component.onKey('B');
      expect(attendanceService.getByEvent).toHaveBeenCalledWith(EVENT_ID, expect.objectContaining({ search: 'AB', limit: 100 }));
    });

    it('clears results when query drops below 2 chars', () => {
      attendanceService.getByEvent.mockReturnValue(of(makePaginatedResponse([makeAttendance()])));
      component.onKey('A');
      component.onKey('B');
      fixture.detectChanges();
      expect(component.results().length).toBeGreaterThan(0);

      component.onKey('⌫');
      expect(component.results()).toHaveLength(0);
    });

    it('filters out ASSISTIT results', () => {
      const items = [
        makeAttendance(AttendanceStatus.ANIRE),
        { ...makeAttendance(AttendanceStatus.ASSISTIT), id: 'att-2' },
        { ...makeAttendance(AttendanceStatus.NO_VAIG), id: 'att-3' },
      ];
      attendanceService.getByEvent.mockReturnValue(of(makePaginatedResponse(items)));
      component.onKey('A');
      component.onKey('B');
      fixture.detectChanges();
      expect(component.results()).toHaveLength(2);
      expect(component.results().every((r) => r.status !== AttendanceStatus.ASSISTIT)).toBe(true);
    });
  });

  // ── confirm ────────────────────────────────────────────────────────────────

  describe('confirm', () => {
    it('calls attendanceService.update with ASSISTIT status', () => {
      const att = makeAttendance();
      component.confirm(att);
      expect(attendanceService.update).toHaveBeenCalledWith(
        EVENT_ID,
        att.id,
        { status: AttendanceStatus.ASSISTIT },
      );
    });

    it('sets recentlyConfirmed to person alias on success', () => {
      const att = { ...makeAttendance(), person: makePerson('Lluna') };
      component.confirm(att);
      expect(component.recentlyConfirmed()).toBe('Lluna');
    });

    it('clears query and reloads on success', () => {
      component.onKey('A');
      component.onKey('B');
      const att = makeAttendance();
      component.confirm(att);
      expect(component.query()).toBe('');
    });

    it('does not call service when already confirming', () => {
      const att = makeAttendance();
      attendanceService.update.mockReturnValue(of({ attendance: att, summary: {} }));

      component.confirmingId.set('some-id');
      component.confirm(att);
      expect(attendanceService.update).not.toHaveBeenCalled();
    });

    it('clears confirmingId on error', () => {
      attendanceService.update.mockReturnValue(throwError(() => new Error('fail')));
      const att = makeAttendance();
      component.confirm(att);
      expect(component.confirmingId()).toBeNull();
    });
  });

  // ── goBack ────────────────────────────────────────────────────────────────

  it('goBack navigates to parent route', () => {
    component.goBack();
    expect(routerMock.navigate).toHaveBeenCalledWith(['..'], expect.any(Object));
  });
});
