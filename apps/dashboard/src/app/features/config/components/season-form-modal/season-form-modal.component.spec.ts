import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { SeasonFormModalComponent } from './season-form-modal.component';
import { SeasonService } from '../../../events/services/season.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { Season } from '../../../events/models/event.model';

const mockSeason: Season = {
  id: 's1',
  name: 'Temporada 2025-2026',
  startDate: '2025-09-06',
  endDate: '2026-09-05',
  description: 'Test description',
  eventCount: 10,
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
      component.saved.subscribe(savedSpy);

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
  });

  describe('cancel', () => {
    it('emits cancelled on cancel', () => {
      const cancelledSpy = vi.fn();
      component.cancelled.subscribe(cancelledSpy);
      component.onCancel();
      expect(cancelledSpy).toHaveBeenCalled();
    });
  });
});
