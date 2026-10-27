import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { AbstractControl, NonNullableFormBuilder, ReactiveFormsModule, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { rxResource, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  DOMAIN_ICONS,
  InputComponent,
  ModalComponent,
  SelectComponent,
  ToastService,
} from '@muixer/ui';
import { CollaSettings, TAG_CATEGORY_LABELS, TagCategory } from '@muixer/shared';
import { CollaSettingsService } from '../../../../core/services/colla-settings.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { TagService } from '../../services/tag.service';

const CATEGORY_ORDER: TagCategory[] = [TagCategory.PINYA, TagCategory.TRONC, TagCategory.XICALLA, TagCategory.ALTRES];

/** Same ranges as the API (`UpdateCollaSettingsDto`). */
const wholeNumber: ValidatorFn = (control) =>
  control.value === null || Number.isInteger(control.value) ? null : { wholeNumber: true };
const range = (min: number, max: number) => [Validators.required, wholeNumber, Validators.min(min), Validators.max(max)];
const notBlank: ValidatorFn = (control) => (String(control.value ?? '').trim() ? null : { required: true });

const link: ValidatorFn = (control) =>
  !control.value || /^https?:\/\/\S+$/.test(String(control.value)) ? null : { link: true };

const warningBelowError: ValidatorFn = (group: AbstractControl): ValidationErrors | null => {
  const { warning, error } = group.value as { warning: number | null; error: number | null };
  return warning !== null && error !== null && warning >= error ? { warningNotBelowError: true } : null;
};

/**
 * The colla's own parameters (`/config/colla`, ADMIN): its name, what a camisa takes, how heights
 * are shown and warned about, the lock after an event, the nightly check-in of performances, how
 * new persons are tagged and counted as xicalla, and what a new rehearsal starts with.
 */
@Component({
  selector: 'app-colla-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    LucideAngularModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
    PageHeaderComponent,
  ],
  templateUrl: './colla-settings.component.html',
})
export class CollaSettingsComponent {
  private readonly collaSettings = inject(CollaSettingsService);
  private readonly tagService = inject(TagService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly ICONS = DOMAIN_ICONS;
  protected readonly loaded = this.collaSettings.loaded;
  protected readonly loadFailed = this.collaSettings.loadFailed;
  protected readonly storedMajorityAge = computed(() => this.collaSettings.settings().majorityAge);

  private readonly tags = rxResource({ stream: () => this.tagService.getAll() });
  protected readonly tagGroups = computed(() => {
    const tags = this.tags.hasValue() ? this.tags.value() : [];
    return CATEGORY_ORDER.map((category) => ({
      label: TAG_CATEGORY_LABELS[category],
      tags: tags.filter((t) => t.category === category).sort((a, b) => a.name.localeCompare(b.name, 'ca')),
    })).filter((group) => group.tags.length > 0);
  });

  readonly form = this.fb.group({
    collaName: ['', [notBlank, Validators.maxLength(100)]],
    shirtRequirements: this.fb.group({
      performances: [0, range(0, 50)],
      rehearsals: [0, range(0, 50)],
    }),
    shoulderHeightBaselineCm: [0, range(50, 250)],
    troncHeightThresholds: this.fb.group({
      floor: this.fb.group({ warning: [0, range(1, 50)], error: [0, range(1, 50)] }, { validators: warningBelowError }),
      support: this.fb.group({ warning: [0, range(1, 50)], error: [0, range(1, 50)] }, { validators: warningBelowError }),
    }),
    assignmentLockDays: [0, range(0, 365)],
    autoCheckInPerformances: [true],
    defaultTagId: [''],
    majorityAge: [0, range(1, 25)],
    rehearsalDefaults: this.fb.group({
      title: ['', Validators.maxLength(200)],
      startTime: ['', Validators.pattern(/^([01]\d|2[0-3]):[0-5]\d$/)],
      location: ['', Validators.maxLength(200)],
      locationUrl: ['', [link, Validators.maxLength(500)]],
    }),
  });

  readonly saving = signal(false);
  readonly confirmingMajorityAge = signal(false);
  /** Bumped on every form event (value, status, dirty, touched), so `canSave` re-reads the form: it isn't a signal. */
  private readonly formVersion = signal(0);

  constructor() {
    // Fill the form once the stored settings arrive, unless someone is already editing it.
    effect(() => {
      const settings = this.collaSettings.settings();
      if (!this.loaded()) return;
      untracked(() => {
        if (!this.form.dirty) this.resetTo(settings);
      });
    });
    this.form.events.pipe(takeUntilDestroyed()).subscribe(() => this.formVersion.update((v) => v + 1));
  }

  protected readonly canSave = computed(() => {
    this.formVersion();
    return this.form.dirty && this.form.valid && !this.saving();
  });

  fieldError(path: string): string | undefined {
    const control = this.form.get(path);
    if (!control || !control.invalid || !(control.touched || control.dirty)) return undefined;
    const errors = control.errors ?? {};
    if (errors['required']) return 'Camp obligatori';
    if (errors['wholeNumber']) return 'Ha de ser un nombre enter';
    if (errors['min']) return `El mínim és ${errors['min'].min}`;
    if (errors['max']) return `El màxim és ${errors['max'].max}`;
    if (errors['maxlength']) return `Màxim ${errors['maxlength'].requiredLength} caràcters`;
    if (errors['link']) return 'Ha de ser un enllaç que comence per https://';
    return 'Valor invàlid';
  }

  /** The error field of a threshold pair also carries «warning must be below error». */
  thresholdError(pair: 'floor' | 'support'): string | undefined {
    const group = this.form.controls.troncHeightThresholds.controls[pair];
    const own = this.fieldError(`troncHeightThresholds.${pair}.error`);
    if (own) return own;
    return group.errors?.['warningNotBelowError'] && (group.touched || group.dirty || this.form.dirty)
      ? "Ha de ser més gran que l'avís"
      : undefined;
  }

  save(): void {
    if (!this.canSave()) return;
    const next = this.formSettings();
    if (next.majorityAge !== this.storedMajorityAge()) {
      this.confirmingMajorityAge.set(true);
      return;
    }
    this.persist(next);
  }

  confirmMajorityAge(): void {
    this.confirmingMajorityAge.set(false);
    this.persist(this.formSettings());
  }

  cancelMajorityAge(): void {
    this.confirmingMajorityAge.set(false);
  }

  discard(): void {
    this.resetTo(this.collaSettings.settings());
  }

  private persist(next: CollaSettings): void {
    this.saving.set(true);
    this.collaSettings.update(next).subscribe({
      next: (saved) => {
        this.saving.set(false);
        this.resetTo(saved);
        this.toast.success("S'ha alçat la configuració de la colla.");
      },
      error: (err: { error?: { message?: string | string[] } }) => {
        this.saving.set(false);
        const message = err?.error?.message;
        this.toast.error(
          (Array.isArray(message) ? message.join(' ') : message) ?? "No s'ha pogut alçar la configuració de la colla.",
        );
      },
    });
  }

  private formSettings(): CollaSettings {
    const raw = this.form.getRawValue();
    return {
      ...raw,
      collaName: raw.collaName.trim(),
      defaultTagId: raw.defaultTagId || null,
      rehearsalDefaults: {
        title: raw.rehearsalDefaults.title.trim(),
        startTime: raw.rehearsalDefaults.startTime || null,
        location: raw.rehearsalDefaults.location.trim(),
        locationUrl: raw.rehearsalDefaults.locationUrl.trim() || null,
      },
    };
  }

  private resetTo(settings: CollaSettings): void {
    this.form.reset({
      ...settings,
      defaultTagId: settings.defaultTagId ?? '',
      rehearsalDefaults: {
        ...settings.rehearsalDefaults,
        startTime: settings.rehearsalDefaults.startTime ?? '',
        locationUrl: settings.rehearsalDefaults.locationUrl ?? '',
      },
    });
    this.formVersion.update((v) => v + 1);
  }
}
