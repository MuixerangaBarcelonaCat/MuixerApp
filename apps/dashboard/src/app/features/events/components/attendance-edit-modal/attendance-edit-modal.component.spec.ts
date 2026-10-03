import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AttendanceStatus } from '@muixer/shared';
import { AttendanceEditModalComponent } from './attendance-edit-modal.component';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceItem } from '../../models/attendance.model';

const attendance: AttendanceItem = {
  status: AttendanceStatus.PENDENT,
  respondedAt: null,
  notes: null,
  person: {
    id: 'person-1',
    alias: 'PERSIANA',
    name: 'Joana',
    firstSurname: 'Vila',
    isXicalla: false,
    notes: null,
    notesEmoji: null,
    positions: [],
  },
};

describe('AttendanceEditModalComponent', () => {
  let fixture: ComponentFixture<AttendanceEditModalComponent>;
  let set: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    set = vi.fn().mockReturnValue(of({ attendance, summary: {} }));
    await TestBed.configureTestingModule({
      imports: [AttendanceEditModalComponent],
      providers: [{ provide: AttendanceService, useValue: { set } }],
    }).compileComponents();

    fixture = TestBed.createComponent(AttendanceEditModalComponent);
    fixture.componentRef.setInput('attendance', attendance);
    fixture.componentRef.setInput('eventId', 'event-1');
    fixture.componentInstance.ngOnChanges();
    fixture.detectChanges();
  });

  it('offers no way to delete the attendance', () => {
    expect(document.body.textContent).not.toContain('Elimina el registre');
  });

  it('saves through set, keyed by person — also for a person with no row', () => {
    const emitted: unknown[] = [];
    fixture.componentInstance.saved.subscribe((r) => emitted.push(r));

    fixture.componentInstance.selectedStatus.set(AttendanceStatus.ANIRE);
    fixture.componentInstance.onSave();

    expect(set).toHaveBeenCalledWith('event-1', 'person-1', { status: AttendanceStatus.ANIRE, notes: null });
    expect(emitted).toHaveLength(1);
  });
});
