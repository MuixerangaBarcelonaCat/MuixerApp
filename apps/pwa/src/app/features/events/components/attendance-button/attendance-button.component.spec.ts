import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { AttendanceStatus } from '@muixer/shared';
import { AttendanceButtonComponent } from './attendance-button.component';
import { EventService } from '../../services/event.service';
import { ToastService } from '../../../../shared/services/toast.service';

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
  ): ComponentFixture<AttendanceButtonComponent> {
    const fixture = TestBed.createComponent(AttendanceButtonComponent);
    fixture.componentRef.setInput('eventId', 'ev-1');
    fixture.componentRef.setInput('status', status);
    fixture.detectChanges();
    return fixture;
  }

  it('should display Pendent when status is null', () => {
    const fixture = createButton(null);
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.textContent.trim()).toContain('Pendent');
  });

  it('should display Vinc when status is ANIRE', () => {
    const fixture = createButton(AttendanceStatus.ANIRE);
    const btn = fixture.nativeElement.querySelector('button');
    expect(btn.textContent.trim()).toContain('Vinc');
  });

  it('should call updateAttendance on click', () => {
    const fixture = createButton(null);
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(eventService.updateAttendance).toHaveBeenCalledWith('ev-1', AttendanceStatus.ANIRE);
  });

  it('should show success toast on successful update', () => {
    const fixture = createButton(null);
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    expect(toastService.success).toHaveBeenCalledWith('Assistència actualitzada.');
  });

  it('should revert status on error', () => {
    eventService.updateAttendance.mockReturnValue(throwError(() => new Error('fail')));
    const fixture = createButton(null);
    const btn = fixture.nativeElement.querySelector('button');
    btn.click();
    fixture.detectChanges();
    expect(toastService.error).toHaveBeenCalled();
    expect(btn.textContent.trim()).toContain('Pendent');
  });
});
