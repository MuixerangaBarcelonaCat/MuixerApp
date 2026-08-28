import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { ToastService } from '@muixer/ui';
import { RollCallComponent } from './roll-call.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

describe('RollCallComponent', () => {
  let fixture: ComponentFixture<RollCallComponent>;
  let rollCallService: {
    getAttendance: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
  };
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
    };
    toastService = { error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [RollCallComponent],
      providers: [
        { provide: RollCallService, useValue: rollCallService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RollCallComponent);
    fixture.componentRef.setInput('id', 'event-1');
    fixture.detectChanges();
  });

  it('loads and renders attendance rows for the event', () => {
    expect(rollCallService.getAttendance).toHaveBeenCalledWith('event-1', undefined);
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
});
