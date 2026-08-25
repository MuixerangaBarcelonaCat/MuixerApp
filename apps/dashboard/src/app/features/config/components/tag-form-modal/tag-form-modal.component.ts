import {
  Component,
  ChangeDetectionStrategy,
  inject,
  input,
  output,
  signal,
  effect,
  computed,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  TRONC_NODE_PRESETS,
  PINYA_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
  TroncNodePreset,
  NodePreset,
  TagCategory,
  TAG_CATEGORY_LABELS,
} from '@muixer/shared';
import { TagService } from '../../services/tag.service';
import { TagWithCount, CreateTagDto, UpdateTagDto } from '../../models/tag.model';
import { BadgeComponent, ButtonComponent, InputComponent, ModalComponent, SelectComponent, ToastService, buildCategoricalHexPresets } from '@muixer/ui';
import { ColorPickerComponent } from '../../../../shared/components/forms/color-picker/color-picker.component';

export interface PresetOption {
  positionType: string;
  label: string;
  color: string;
}

export interface PositionTypeGroup {
  label: string;
  /** Which tag category this group is relevant for — drives `visiblePositionTypeGroups`. */
  category: TagCategory;
  presets: PresetOption[];
}

const DEFAULT_COLOR = '#6366f1';

@Component({
  selector: 'app-tag-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, BadgeComponent, ButtonComponent, ColorPickerComponent, InputComponent, ModalComponent, SelectComponent],
  templateUrl: './tag-form-modal.component.html',
})
export class TagFormModalComponent {
  private readonly fb = inject(FormBuilder);
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);

  readonly position = input<TagWithCount | null>(null);
  readonly saved = output<TagWithCount>();
  readonly cancelled = output<void>();

  readonly saving = signal(false);
  readonly selectedPositionTypes = signal<string[]>([]);

  // The categorical palette (§2.1i) — 10 hues, normal + light — rather than an arbitrary swatch
  // set: a tag's color is exactly the same "curated set of distinguishable colors" concern as the
  // canvas's own categorical palette (see Phase 1 audit, §1.3's "domain-color seams" finding).
  readonly colorPresets = buildCategoricalHexPresets();

  readonly positionTypeGroups: PositionTypeGroup[] = [
    {
      label: 'Tronc',
      category: TagCategory.TRONC,
      presets: TRONC_NODE_PRESETS.map((p: TroncNodePreset) => ({
        positionType: p.positionType,
        label: p.label,
        color: p.color,
      })),
    },
    {
      label: 'Pinya',
      category: TagCategory.PINYA,
      presets: PINYA_NODE_PRESETS.map((p: NodePreset) => ({
        positionType: p.positionType as string,
        label: p.label,
        color: p.color ?? DEFAULT_COLOR,
      })),
    },
    {
      label: 'Direcció',
      category: TagCategory.TRONC,
      presets: DIRECTION_NODE_PRESETS.map((p: NodePreset) => ({
        positionType: p.positionType as string,
        label: p.label,
        color: p.color ?? DEFAULT_COLOR,
      })),
    },
    {
      label: 'Base',
      category: TagCategory.TRONC,
      presets: [{ positionType: 'base', label: 'Base', color: '#64748b' }],
    },
  ];

  readonly categoryOptions = Object.values(TagCategory);
  readonly categoryLabels = TAG_CATEGORY_LABELS;

  readonly form = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    shortDescription: [''],
    longDescription: [''],
    color: [DEFAULT_COLOR],
    category: [null as TagCategory | null, Validators.required],
  });

  private readonly categorySignal = toSignal(this.form.get('category')!.valueChanges, {
    initialValue: this.form.get('category')!.value,
  });

  readonly visiblePositionTypeGroups = computed(() => {
    const category = this.categorySignal();
    if (!category) return [];
    return this.positionTypeGroups.filter((g) => g.category === category);
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
          color: pos.color ?? DEFAULT_COLOR,
          category: pos.category,
        });
        this.form.get('slug')!.disable();
        this.selectedPositionTypes.set(pos.positionTypes ?? []);
      } else {
        this.form.reset({ color: DEFAULT_COLOR, category: null });
        this.form.get('slug')!.enable();
        this.selectedPositionTypes.set([]);
      }
    });

    // Drop selections that belong to groups hidden by the newly-selected category.
    effect(() => {
      const visibleTypes = new Set(
        this.visiblePositionTypeGroups().flatMap((g) => g.presets.map((p) => p.positionType)),
      );
      const current = this.selectedPositionTypes();
      const filtered = current.filter((pt) => visibleTypes.has(pt));
      if (filtered.length !== current.length) {
        this.selectedPositionTypes.set(filtered);
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
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.form.get('slug')!.setValue(slug, { emitEvent: false });
  }

  onColorChange(hex: string): void {
    this.form.get('color')!.setValue(hex);
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
        shortDescription: raw.shortDescription || undefined,
        longDescription: raw.longDescription || undefined,
        color: raw.color || undefined,
        category: raw.category ?? undefined,
        positionTypes,
      };
      this.tagService.update(this.position()!.id, dto).subscribe({
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
        category: raw.category!,
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
