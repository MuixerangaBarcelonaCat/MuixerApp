import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { RollCallComponent } from './roll-call.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';
import { PersonLookupService } from '../services/person-lookup.service';

describe('RollCallComponent', () => {
  let fixture: ComponentFixture<RollCallComponent>;
  let rollCallService: {
    getAttendance: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
    createAttendance: ReturnType<typeof vi.fn>;
  };
  let personLookupService: { search: ReturnType<typeof vi.fn> };
  let toastService: { error: ReturnType<typeof vi.fn> };

  const attendanceItems: AttendanceItem[] = [
    {
      id: 'att-1',
      status: AttendanceStatus.PENDENT,
      person: { id: 'person-1', alias: 'Anna', name: 'Anna', firstSurname: 'Puig' },
    },
    {
      id: 'att-2',
      status: AttendanceStatus.ANIRE,
      person: { id: 'person-2', alias: 'Jordi', name: 'Jordi', firstSurname: 'Ferrer' },
    },
  ];

  beforeEach(async () => {
    rollCallService = {
      getAttendance: vi.fn().mockReturnValue(
        of({ data: attendanceItems, meta: { total: 2, page: 1, limit: 100 } }),
      ),
      updateAttendance: vi.fn(),
      createAttendance: vi.fn(),
    };
    personLookupService = { search: vi.fn().mockReturnValue(of([])) };
    toastService = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RollCallComponent],
      providers: [
        { provide: RollCallService, useValue: rollCallService },
        { provide: PersonLookupService, useValue: personLookupService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RollCallComponent);
    fixture.componentRef.setInput('id', 'event-1');
    fixture.detectChanges();
  });

  it('loads attendance and shows only signed-up people by default', () => {
    expect(rollCallService.getAttendance).toHaveBeenCalledWith('event-1', undefined);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="roll-call-row"]');
    expect(rows.length).toBe(1);
  });

  it('shows everyone when "Mostra tots" is toggled on', () => {
    fixture.componentInstance['showAll'].set(true);
    fixture.detectChanges();
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="roll-call-row"]');
    expect(rows.length).toBe(2);
  });

  it('updates an existing attendance record', () => {
    rollCallService.updateAttendance.mockReturnValue(
      of({ attendance: { id: 'att-1', status: AttendanceStatus.ASSISTIT }, summary: {} }),
    );
    fixture.componentInstance['setStatus'](attendanceItems[0], AttendanceStatus.ASSISTIT);
    expect(rollCallService.updateAttendance).toHaveBeenCalledWith('event-1', 'att-1', {
      status: AttendanceStatus.ASSISTIT,
    });
  });

  it('shows a toast and leaves the row unchanged when the update fails', () => {
    rollCallService.updateAttendance.mockReturnValue(throwError(() => new Error('fail')));
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(toastService.error).toHaveBeenCalledWith("No s'ha pogut actualitzar l'assistència");
  });

  it('opens the override prompt on a 403 (locked event) instead of a toast', () => {
    rollCallService.updateAttendance.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(toastService.error).not.toHaveBeenCalled();
    expect(fixture.componentInstance['overridePrompt']()).toEqual({
      item: attendanceItems[1],
      status: AttendanceStatus.ASSISTIT,
    });
  });

  it('retries with force:true when the override is confirmed', () => {
    rollCallService.updateAttendance
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 403 })))
      .mockReturnValueOnce(of({ attendance: { id: 'att-2', status: AttendanceStatus.ASSISTIT }, summary: {} }));
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);

    fixture.componentInstance['confirmOverride']();

    expect(rollCallService.updateAttendance).toHaveBeenLastCalledWith('event-1', 'att-2', {
      status: AttendanceStatus.ASSISTIT,
      force: true,
    });
    expect(fixture.componentInstance['overridePrompt']()).toBeNull();
  });

  it('adds a person found via search as ASSISTIT', () => {
    rollCallService.createAttendance.mockReturnValue(
      of({ attendance: { id: 'att-3', status: AttendanceStatus.ASSISTIT }, summary: {} }),
    );
    const newPerson = { id: 'person-3', alias: 'Marc', name: 'Marc', firstSurname: 'Roig' };

    fixture.componentInstance['addPerson'](newPerson);

    expect(rollCallService.createAttendance).toHaveBeenCalledWith('event-1', {
      personId: 'person-3',
      status: AttendanceStatus.ASSISTIT,
    });
  });
});
