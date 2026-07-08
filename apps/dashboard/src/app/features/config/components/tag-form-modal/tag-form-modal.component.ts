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
import {
  TRONC_NODE_PRESETS,
  PINYA_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
  TroncNodePreset,
  NodePreset,
} from '@muixer/shared';
import { TagService } from '../../services/tag.service';
import { TagWithCount, CreateTagDto, UpdateTagDto } from '../../models/tag.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { getContrastColor } from '../../../../shared/utils/color.util';

export interface PresetOption {
  positionType: string;
  label: string;
  color: string;
}

export interface PositionTypeGroup {
  label: string;
  presets: PresetOption[];
}

const DEFAULT_COLOR = '#6366f1';

@Component({
  selector: 'app-tag-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './tag-form-modal.component.html',
})
export class TagFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);

  readonly tag = input<TagWithCount | null>(null);
  readonly saved = output<TagWithCount>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly selectedPositionTypes = signal<string[]>([]);
  readonly getContrastColor = getContrastColor;

  readonly positionTypeGroups: PositionTypeGroup[] = [
    {
      label: 'Tronc',
      presets: TRONC_NODE_PRESETS.map((p: TroncNodePreset) => ({
        positionType: p.positionType,
        label: p.label,
        color: p.color,
      })),
    },
    {
      label: 'Pinya',
      presets: PINYA_NODE_PRESETS.map((p: NodePreset) => ({
        positionType: p.positionType as string,
        label: p.label,
        color: p.color ?? DEFAULT_COLOR,
      })),
    },
    {
      label: 'Direcció',
      presets: DIRECTION_NODE_PRESETS.map((p: NodePreset) => ({
        positionType: p.positionType as string,
        label: p.label,
        color: p.color ?? DEFAULT_COLOR,
      })),
    },
    {
      label: 'Base',
      presets: [{ positionType: 'base', label: 'Base', color: '#64748b' }],
    },
  ];

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    shortDescription: [''],
    longDescription: [''],
    color: [DEFAULT_COLOR],
  });

  constructor() {
    effect(() => {
      const t = this.tag();
      if (t) {
        this.form.patchValue({
          name: t.name,
          slug: t.slug,
          shortDescription: t.shortDescription ?? '',
          longDescription: t.longDescription ?? '',
          color: t.color ?? DEFAULT_COLOR,
        });
        this.form.get('slug')!.disable();
        this.selectedPositionTypes.set(t.positionTypes ?? []);
      } else {
        this.form.reset({ color: DEFAULT_COLOR });
        this.form.get('slug')!.enable();
        this.selectedPositionTypes.set([]);
      }
    });
  }

  get isEditMode(): boolean {
    return !!this.tag();
  }

  onNameInput(): void {
    if (this.isEditMode) return;
    const name = this.form.get('name')!.value ?? '';
    const slug = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.form.get('slug')!.setValue(slug, { emitEvent: false });
  }

  isPositionTypeSelected(positionType: string): boolean {
    return this.selectedPositionTypes().includes(positionType);
  }

  togglePositionType(preset: PresetOption): void {
    const current = this.selectedPositionTypes();
    const isSelected = current.includes(preset.positionType);

    if (isSelected) {
      this.selectedPositionTypes.set(current.filter((p) => p !== preset.positionType));
      if (!this.isEditMode && this.selectedPositionTypes().length === 0) {
        this.form.get('color')!.setValue(DEFAULT_COLOR);
      }
    } else {
      this.selectedPositionTypes.set([...current, preset.positionType]);
      if (!this.isEditMode) {
        this.form.get('color')!.setValue(preset.color);
      }
    }
  }

  onSave(): void {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);

    const raw = this.form.getRawValue();
    const positionTypes = this.selectedPositionTypes();

    if (this.isEditMode) {
      const dto: UpdateTagDto = {
        name: raw.name ?? undefined,
        shortDescription: raw.shortDescription || null,
        longDescription: raw.longDescription || null,
        color: raw.color || null,
        positionTypes,
      };
      this.tagService.update(this.tag()!.id, dto).subscribe({
        next: (updated) => {
          this.saving.set(false);
          this.toast.success('Etiqueta actualitzada correctament.');
          this.saved.emit(updated);
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? "Error en actualitzar l'etiqueta.";
          this.toast.error(msg);
        },
      });
    } else {
      const dto: CreateTagDto = {
        name: raw.name!,
        slug: raw.slug!,
        shortDescription: raw.shortDescription || undefined,
        longDescription: raw.longDescription || undefined,
        color: raw.color || undefined,
        positionTypes,
      };
      this.tagService.create(dto).subscribe({
        next: (created) => {
          this.saving.set(false);
          this.toast.success('Etiqueta creada correctament.');
          this.saved.emit(created);
        },
        error: (err) => {
          this.saving.set(false);
          const msg = err?.error?.message ?? "Error en crear l'etiqueta.";
          this.toast.error(msg);
        },
      });
    }
  }

  onCancel(): void {
    this.cancelled.emit();
  }
}
