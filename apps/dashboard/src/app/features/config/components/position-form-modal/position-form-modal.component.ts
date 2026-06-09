import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { FigureZone } from '@muixer/shared';
import { PositionService } from '../../services/position.service';
import { PositionWithCount, CreatePositionDto, UpdatePositionDto } from '../../models/position.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';

@Component({
  selector: 'app-position-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './position-form-modal.component.html',
})
export class PositionFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly positionService = inject(PositionService);
  private readonly toast = inject(ToastService);

  readonly position = input<PositionWithCount | null>(null);
  readonly saved = output<PositionWithCount>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly zoneOptions = Object.values(FigureZone);

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    shortDescription: [''],
    longDescription: [''],
    color: ['#6366f1'],
    zone: ['' as FigureZone | ''],
  });

  constructor() {
    effect(() => {
      const pos = this.position();
      if (pos) {
        this.form.patchValue({
          name: pos.name,
          slug: pos.slug,
          shortDescription: pos.shortDescription ?? '',
          longDescription: pos.longDescription ?? '',
          color: pos.color ?? '#6366f1',
          zone: pos.zone ?? '',
        });
        this.form.get('slug')!.disable();
      } else {
        this.form.reset({ color: '#6366f1', zone: '' });
        this.form.get('slug')!.enable();
      }
    });
  }

  get isEditMode(): boolean {
    return !!this.position();
  }

  onNameInput(): void {
    if (this.isEditMode) return;
    const name = this.form.get('name')!.value ?? '';
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.form.get('slug')!.setValue(slug, { emitEvent: false });
  }

  onSave(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const zone = raw.zone as FigureZone | '';

    if (this.isEditMode) {
      const dto: UpdatePositionDto = {
        name: raw.name ?? undefined,
        shortDescription: raw.shortDescription || undefined,
        longDescription: raw.longDescription || undefined,
        color: raw.color || undefined,
        zone: zone || undefined,
      };
      this.positionService.update(this.position()!.id, dto).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.toast.success('Posició actualitzada correctament.');
          this.saved.emit(updated);
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? "Error en actualitzar la posició.";
          this.toast.error(msg);
        },
      });
    } else {
      const dto: CreatePositionDto = {
        name: raw.name!,
        slug: raw.slug!,
        shortDescription: raw.shortDescription || undefined,
        longDescription: raw.longDescription || undefined,
        color: raw.color || undefined,
        zone: zone || undefined,
      };
      this.positionService.create(dto).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.toast.success('Posició creada correctament.');
          this.saved.emit(created);
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? "Error en crear la posició.";
          this.toast.error(msg);
        },
      });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
