import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
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
    createAttendance: ReturnType<typeof vi.fn>;
    createProvisionalPerson: ReturnType<typeof vi.fn>;
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
      createAttendance: vi.fn(),
      createProvisionalPerson: vi.fn(),
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

  it('labels the add-person button "+ Persona nova"', () => {
    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Afegeix una persona provisional (ve per primera vegada)"]',
    );
    expect(addBtn.textContent).toContain('+ Persona nova');
  });

  it('lets the search box shrink so the add-person button stays on screen on narrow viewports', () => {
    const searchLabel: HTMLElement = fixture.nativeElement.querySelector('label.input');
    expect(searchLabel.className).toContain('min-w-0');
    const addBtn: HTMLButtonElement = fixture.nativeElement.querySelector(
      '[aria-label="Afegeix una persona provisional (ve per primera vegada)"]',
    );
    expect(addBtn.className).toContain('shrink-0');
  });

  it('renders the status buttons as Ha vingut / Vindrà / No vindrà, in that order', () => {
    const row = fixture.nativeElement.querySelector('[data-testid="roll-call-row"]');
    const labels = Array.from(row.querySelectorAll('lib-button-group button')).map(
      (b) => (b as HTMLElement).textContent?.trim(),
    );
    expect(labels).toEqual(['Ha vingut', 'Vindrà', 'No vindrà']);
  });

  it('calls setStatus when a status button is clicked', () => {
    rollCallService.updateAttendance.mockReturnValue(
      of({ attendance: { id: 'att-2', status: AttendanceStatus.ASSISTIT }, summary: {} }),
    );
    const row = fixture.nativeElement.querySelector('[data-testid="roll-call-row"]');
    const buttons: HTMLButtonElement[] = row.querySelectorAll('lib-button-group button');
    buttons[0].click(); // "Ha vingut" is first now

    expect(rollCallService.updateAttendance).toHaveBeenCalledWith('event-1', 'att-2', {
      status: AttendanceStatus.ASSISTIT,
    });
  });

  it('loads attendance and splits it into signed-up and not-signed-up rows', () => {
    expect(rollCallService.getAttendance).toHaveBeenCalledWith('event-1', undefined);
    const rows = fixture.nativeElement.querySelectorAll('[data-testid="roll-call-row"]');
    expect(rows.length).toBe(2);
    expect(fixture.componentInstance['signedUpItems']()).toEqual([attendanceItems[1]]);
    expect(fixture.componentInstance['notSignedUpItems']()).toEqual([attendanceItems[0]]);
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

  it('shows the fallback toast when the update fails with no server message', () => {
    rollCallService.updateAttendance.mockReturnValue(throwError(() => new Error('fail')));
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(toastService.error).toHaveBeenCalledWith("No s'ha pogut actualitzar l'assistència");
  });

  it('surfaces the server error message when the update fails with one', () => {
    rollCallService.updateAttendance.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ja existeix' } })),
    );
    fixture.componentInstance['setStatus'](attendanceItems[1], AttendanceStatus.ASSISTIT);
    expect(toastService.error).toHaveBeenCalledWith('Ja existeix');
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

  it('toggles the add-provisional panel', () => {
    expect(fixture.componentInstance['showAddProvisional']()).toBe(false);
    fixture.componentInstance['toggleAddProvisional']();
    expect(fixture.componentInstance['showAddProvisional']()).toBe(true);
    fixture.componentInstance['toggleAddProvisional']();
    expect(fixture.componentInstance['showAddProvisional']()).toBe(false);
  });

  it('creates a provisional person and marks them ASSISTIT', () => {
    const newPerson = { id: 'person-3', alias: '~Pepelu', name: 'Pepelu', firstSurname: '' };
    rollCallService.createProvisionalPerson.mockReturnValue(of(newPerson));
    rollCallService.createAttendance.mockReturnValue(
      of({ attendance: { id: 'att-3', status: AttendanceStatus.ASSISTIT }, summary: {} }),
    );

    fixture.componentInstance['provisionalAlias'].set('Pepelu');
    fixture.componentInstance['createProvisionalPerson']();

    expect(rollCallService.createProvisionalPerson).toHaveBeenCalledWith('Pepelu');
    expect(rollCallService.createAttendance).toHaveBeenCalledWith('event-1', {
      personId: 'person-3',
      status: AttendanceStatus.ASSISTIT,
    });
    expect(fixture.componentInstance['showAddProvisional']()).toBe(false);
  });

  it('surfaces the server error message when the alias is already taken', () => {
    rollCallService.createProvisionalPerson.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { message: 'Ja existeix una persona provisional amb l\'àlies "Pepelu"' } })),
    );
    fixture.componentInstance['provisionalAlias'].set('Pepelu');

    fixture.componentInstance['createProvisionalPerson']();

    expect(toastService.error).toHaveBeenCalledWith('Ja existeix una persona provisional amb l\'àlies "Pepelu"');
    expect(rollCallService.createAttendance).not.toHaveBeenCalled();
  });
});
