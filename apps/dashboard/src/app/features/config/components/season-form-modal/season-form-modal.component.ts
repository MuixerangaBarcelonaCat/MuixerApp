import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl } from '@angular/forms';
import { SeasonService, CreateSeasonPayload, UpdateSeasonPayload } from '../../../events/services/season.service';
import { Season } from '../../../events/models/event.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

@Component({
  selector: 'app-season-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './season-form-modal.component.html',
})
export class SeasonFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly seasonService = inject(SeasonService);
  private readonly toast = inject(ToastService);

  readonly season = input<Season | null>(null);
  readonly saved = output<void>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    description: ['', [Validators.maxLength(500)]],
  });

  constructor() {
    effect(() => {
      const s = this.season();
      if (s) {
        this.form.patchValue({
          name: s.name,
          startDate: s.startDate.slice(0, 10),
          endDate: s.endDate.slice(0, 10),
          description: s.description ?? '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  get isEditMode(): boolean {
    return !!this.season();
  }

  get dateRangeInvalid(): boolean {
    const start = this.form.get('startDate')?.value;
    const end = this.form.get('endDate')?.value;
    if (!start || !end) return false;
    return new Date(end) <= new Date(start);
  }

  onSave(): void {
    if (this.form.invalid || this.saving() || this.dateRangeInvalid) return;

    this.saving.set(true);
    this.errorMessage.set(null);

    const raw = this.form.getRawValue();

    if (this.isEditMode) {
      const dto: UpdateSeasonPayload = {
        name: raw.name || undefined,
        startDate: raw.startDate || undefined,
        endDate: raw.endDate || undefined,
        description: raw.description || undefined,
      };
      this.seasonService.update(this.season()!.id, dto).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Temporada actualitzada correctament.');
          this.saved.emit();
        },
        error: (err) => this.handleError(err),
      });
    } else {
      const dto: CreateSeasonPayload = {
        name: raw.name!,
        startDate: raw.startDate!,
        endDate: raw.endDate!,
        ...(raw.description ? { description: raw.description } : {}),
      };
      this.seasonService.create(dto).subscribe({
        next: () => {
          this.saving.set(false);
          this.toast.success('Temporada creada correctament.');
          this.saved.emit();
        },
        error: (err) => this.handleError(err),
      });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  fieldError(controlName: string): string | null {
    const ctrl = this.form.get(controlName) as AbstractControl;
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return null;
    if (ctrl.errors?.['required']) return 'Camp obligatori';
    if (ctrl.errors?.['maxlength']) return `Màxim ${ctrl.errors['maxlength'].requiredLength} caràcters`;
    return 'Valor invàlid';
  }

  private handleError(err: { error?: { message?: string | string[] } }): void {
    this.saving.set(false);
    const message = err?.error?.message ?? 'Error en desar la temporada.';
    this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
  }
}
