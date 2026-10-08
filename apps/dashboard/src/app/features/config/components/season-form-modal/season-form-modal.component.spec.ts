import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SeasonFormModalComponent } from './season-form-modal.component';
import { SeasonService } from '../../../events/services/season.service';
import { ToastService } from '@muixer/ui';
import { Season } from '../../../events/models/event.model';
import { SEASON_LEAVES_EVENTS_UNCOVERED } from '@muixer/shared';

const mockSeason: Season = {
  id: 's1',
  name: 'Temporada 2025-2026',
  startDate: '2025-09-06',
  endDate: '2026-09-05',
  description: 'Test description',
  eventCount: 10,
  rehearsalCount: 10,
  performanceCount: 0,
};

describe('SeasonFormModalComponent', () => {
  let component: SeasonFormModalComponent;
  let fixture: ComponentFixture<SeasonFormModalComponent>;
  let seasonService: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let toast: { success: ReturnType<typeof vi.fn>; error: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    seasonService = {
      create: vi.fn().mockReturnValue(of(mockSeason)),
      update: vi.fn().mockReturnValue(of(mockSeason)),
    };
    toast = { success: vi.fn(), error: vi.fn() };

    await TestBed.configureTestingModule({
      imports: [SeasonFormModalComponent],
      providers: [
        { provide: SeasonService, useValue: seasonService },
        { provide: ToastService, useValue: toast },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SeasonFormModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('create mode', () => {
    it('starts with empty form', () => {
      expect(component.isEditMode).toBe(false);
      expect(component.form.get('name')?.value).toBeFalsy();
    });

    it('validates required fields', () => {
      component.form.get('name')?.markAsTouched();
      expect(component.fieldError('name')).toBe('Camp obligatori');
    });

    it('validates date range', () => {
      component.form.patchValue({
        startDate: '2026-09-01',
        endDate: '2026-08-01',
      });
      expect(component.dateRangeInvalid).toBe(true);
    });

    it('does not submit when form is invalid', () => {
      component.onSave();
      expect(seasonService.create).not.toHaveBeenCalled();
    });

    it('submits valid form and emits saved', () => {
      const savedSpy = vi.fn();
      component.saved.subscribe(() => savedSpy());

      component.form.patchValue({
        name: 'Nova temporada',
        startDate: '2026-09-01',
        endDate: '2027-09-01',
      });
      component.onSave();

      expect(seasonService.create).toHaveBeenCalledWith({
        name: 'Nova temporada',
        startDate: '2026-09-01',
        endDate: '2027-09-01',
      });
      expect(toast.success).toHaveBeenCalled();
      expect(savedSpy).toHaveBeenCalled();
    });

    it('shows error message on failure', () => {
      seasonService.create.mockReturnValue(
        throwError(() => ({ error: { message: 'Les dates se solapen' } })),
      );

      component.form.patchValue({
        name: 'Overlap',
        startDate: '2025-09-01',
        endDate: '2026-09-01',
      });
      component.onSave();

      expect(component.errorMessage()).toBe('Les dates se solapen');
    });
  });

  describe('edit mode', () => {
    beforeEach(() => {
      fixture = TestBed.createComponent(SeasonFormModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('season', mockSeason);
      fixture.detectChanges();
    });

    it('patches form with season data', () => {
      expect(component.isEditMode).toBe(true);
      expect(component.form.get('name')?.value).toBe('Temporada 2025-2026');
      expect(component.form.get('startDate')?.value).toBe('2025-09-06');
      expect(component.form.get('endDate')?.value).toBe('2026-09-05');
    });

    it('calls update on save', () => {
      component.form.patchValue({ name: 'Updated' });
      component.onSave();
      expect(seasonService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Updated' }));
      expect(toast.success).toHaveBeenCalled();
    });

    it('sends null description when the field is cleared', () => {
      component.form.patchValue({ description: '' });
      component.onSave();
      expect(seasonService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ description: null }));
    });

    it('keeps the description when it is still filled', () => {
      component.onSave();
      expect(seasonService.update).toHaveBeenCalledWith('s1', expect.objectContaining({ description: 'Test description' }));
    });
  });

  describe('cancel', () => {
    it('emits cancelled on cancel', () => {
      const cancelledSpy = vi.fn();
      component.cancelled.subscribe(cancelledSpy);
      component.onCancel();
      expect(cancelledSpy).toHaveBeenCalled();
    });
  });

  describe('edit that would leave events in no season', () => {
    const uncovered409 = (count: number) =>
      throwError(() => ({
        status: 409,
        error: {
          statusCode: 409,
          code: SEASON_LEAVES_EVENTS_UNCOVERED,
          uncoveredCount: count,
          message: `${count} esdeveniments quedarien fora de qualsevol temporada.`,
        },
      }));
    let savedSpy: ReturnType<typeof vi.fn<() => void>>;

    beforeEach(() => {
      fixture = TestBed.createComponent(SeasonFormModalComponent);
      component = fixture.componentInstance;
      fixture.componentRef.setInput('season', mockSeason);
      savedSpy = vi.fn();
      component.saved.subscribe(() => savedSpy());
      fixture.detectChanges();
      seasonService.update.mockReturnValueOnce(uncovered409(3));
      component.form.patchValue({ startDate: '2025-09-10' });
      component.onSave();
      fixture.detectChanges();
    });

    it('asks to confirm instead of showing an error', () => {
      expect(component.uncoveredWarning()).toBe('3 esdeveniments quedaran sense temporada. Voleu continuar?');
      expect(component.errorMessage()).toBeNull();
      expect(savedSpy).not.toHaveBeenCalled();
      expect(fixture.nativeElement.textContent).toContain('Alça igualment');
    });

    it('resubmits with allowUncovered once confirmed', () => {
      component.onSave();
      expect(seasonService.update).toHaveBeenLastCalledWith(
        's1',
        expect.objectContaining({ startDate: '2025-09-10' }),
        { allowUncovered: true },
      );
      expect(savedSpy).toHaveBeenCalled();
    });

    it('drops the pending confirmation when the form is edited again', () => {
      component.form.patchValue({ startDate: '2025-09-12' });
      expect(component.uncoveredWarning()).toBeNull();
      component.onSave();
      expect(seasonService.update).toHaveBeenLastCalledWith('s1', expect.objectContaining({ startDate: '2025-09-12' }));
    });

    it('uses the singular for a single event', () => {
      component.form.patchValue({ startDate: '2025-09-08' });
      seasonService.update.mockReturnValueOnce(uncovered409(1));
      component.onSave();
      expect(component.uncoveredWarning()).toBe('1 esdeveniment quedarà sense temporada. Voleu continuar?');
    });
  });
});
