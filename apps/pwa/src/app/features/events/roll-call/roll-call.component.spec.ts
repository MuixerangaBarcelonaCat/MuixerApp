import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { RollCallComponent } from './roll-call.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

describe('RollCallComponent', () => {
  let fixture: ComponentFixture<RollCallComponent>;
  let rollCallService: {
    getAttendance: ReturnType<typeof vi.fn>;
    createAttendance: ReturnType<typeof vi.fn>;
    updateAttendance: ReturnType<typeof vi.fn>;
  };

  const attendanceItems: AttendanceItem[] = [
    {
      id: 'pending-person-1',
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
      createAttendance: vi.fn(),
      updateAttendance: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RollCallComponent],
      providers: [{ provide: RollCallService, useValue: rollCallService }],
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

  it('creates a new attendance record when the person has none yet', () => {
    rollCallService.createAttendance.mockReturnValue(
      of({ id: 'att-1', status: AttendanceStatus.ASSISTIT }),
    );
    fixture.componentInstance['setStatus'](attendanceItems[0], AttendanceStatus.ASSISTIT);
    expect(rollCallService.createAttendance).toHaveBeenCalledWith('event-1', {
      personId: 'person-1',
      status: AttendanceStatus.ASSISTIT,
    });
  });

  it('updates an existing attendance record', () => {
    rollCallService.updateAttendance.mockReturnValue(
      of({ id: 'att-2', status: AttendanceStatus.ASSISTIT }),
    );
    // att-2 already has a non-PENDENT status, so it's treated as an existing record to update.
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(rollCallService.updateAttendance).toHaveBeenCalledWith('event-1', 'att-2', {
      status: AttendanceStatus.ASSISTIT,
    });
  });
});
