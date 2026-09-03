import { TestBed, ComponentFixture } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { of, throwError } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { AttendanceButtonComponent } from './attendance-button.component';
import { EventService } from '../../services/event.service';
import { ToastService } from '@muixer/ui';

describe('AttendanceButtonComponent', () => {
  let eventService: { updateAttendance: ReturnType<typeof vi.fn> };
  let toastService: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    eventService = {
      updateAttendance: vi.fn().mockReturnValue(
        of({ id: 'att-1', status: AttendanceStatus.ANIRE, respondedAt: new Date().toISOString() }),
      ),
    };
    toastService = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [AttendanceButtonComponent],
      providers: [
        { provide: EventService, useValue: eventService },
        { provide: ToastService, useValue: toastService },
      ],
    }).compileComponents();
  });

  function createButton(
    status: AttendanceStatus | null = null,
    personId?: string,
  ): ComponentFixture<AttendanceButtonComponent> {
    const fixture = TestBed.createComponent(AttendanceButtonComponent);
    fixture.componentRef.setInput('eventId', 'ev-1');
    fixture.componentRef.setInput('status', status);
    if (personId !== undefined) fixture.componentRef.setInput('personId', personId);
    fixture.detectChanges();
    return fixture;
  }

  it('should render Vinc and No vinc buttons when status is null', () => {
    const fixture = createButton(null);
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(buttons.length).toBe(2);
    expect(buttons[0].textContent).toContain('Vinc');
    expect(buttons[1].textContent).toContain('No vinc');
  });

  it('should highlight Vinc button when status is ANIRE', () => {
    const fixture = createButton(AttendanceStatus.ANIRE);
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].classList.contains('btn-success')).toBe(true);
    expect(buttons[0].classList.contains('btn-outline')).toBe(false);
  });

  it('should render the inactive segment as a neutral outline, not colored', () => {
    const fixture = createButton(AttendanceStatus.ANIRE);
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[1].classList.contains('btn-neutral')).toBe(true);
    expect(buttons[1].classList.contains('btn-outline')).toBe(true);
    expect(buttons[1].classList.contains('btn-error')).toBe(false);
  });

  it('should render the two buttons as a compact joined group, sized to their labels', () => {
    const fixture = createButton(null);
    const join: HTMLElement = fixture.nativeElement.querySelector('.join');
    expect(join).toBeTruthy();
    expect(join.className).not.toContain('w-full');
    const buttons: HTMLButtonElement[] = fixture.nativeElement.querySelectorAll('button');
    expect(buttons[0].classList.contains('btn-xs')).toBe(true);
  });

  it('should call updateAttendance with ANIRE when clicking Vinc', () => {
    const fixture = createButton(null);
    const vincBtn = fixture.nativeElement.querySelector('button');
    vincBtn.click();
    expect(eventService.updateAttendance).toHaveBeenCalledWith('ev-1', AttendanceStatus.ANIRE, undefined);
  });

  it('should call updateAttendance with the given personId', () => {
    const fixture = createButton(null, 'person-2');
    const vincBtn = fixture.nativeElement.querySelector('button');
    vincBtn.click();
    expect(eventService.updateAttendance).toHaveBeenCalledWith('ev-1', AttendanceStatus.ANIRE, 'person-2');
  });

  it('should not show a toast on successful update', () => {
    const fixture = createButton(null);
    fixture.nativeElement.querySelector('button').click();
    expect(toastService.success).not.toHaveBeenCalled();
  });

  it('should revert status on error and show fallback message', () => {
    eventService.updateAttendance.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500 })),
    );
    const fixture = createButton(null);
    fixture.nativeElement.querySelector('button').click();
    fixture.detectChanges();

    expect(toastService.error).toHaveBeenCalledWith("No s'ha pogut actualitzar l'assistència.");
    const vincBtn: HTMLButtonElement = fixture.nativeElement.querySelector('button');
    expect(vincBtn.classList.contains('btn-success')).toBe(false);
  });

  it('should show server error message when available', () => {
    eventService.updateAttendance.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 400,
        error: { message: 'Fora de termini' },
      })),
    );
    const fixture = createButton(null);
    fixture.nativeElement.querySelector('button').click();
    expect(toastService.error).toHaveBeenCalledWith('Fora de termini');
  });

  it('should show locked badge when status is ASSISTIT', () => {
    const fixture = createButton(AttendanceStatus.ASSISTIT);
    const badge = fixture.nativeElement.querySelector('.badge');
    expect(badge).toBeTruthy();
    expect(badge.textContent).toContain('He assistit');
  });
});
