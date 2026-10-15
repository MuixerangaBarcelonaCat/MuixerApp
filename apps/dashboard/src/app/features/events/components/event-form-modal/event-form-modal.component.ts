import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  OnInit,
  signal,
  computed,
  inject,
  OnChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { AlertComponent, ButtonComponent, CheckboxComponent, InputComponent, ModalComponent, SelectComponent, TextareaComponent } from '@muixer/ui';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { EventDetail, Season, CreateEventPayload, UpdateEventPayload, EventType } from '../../models/event.model';
import { findSeasonForDate } from '../../utils/season.util';

@Component({
  selector: 'app-event-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule, AlertComponent, ButtonComponent, CheckboxComponent, InputComponent, ModalComponent, SelectComponent, TextareaComponent],
  templateUrl: './event-form-modal.component.html',
})
export class EventFormModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);
  private readonly seasonService = inject(SeasonService);

  readonly EventType = EventType;

  event = input<EventDetail | null>(null);
  presetEventType = input<EventType | null>(null);

  saved = output<EventDetail>();
  closed = output<void>();

  isEditMode = computed(() => this.event() !== null);
  modalTitle = computed(() => {
    if (this.isEditMode()) return 'Editar esdeveniment';
    const preset = this.presetEventType();
    if (preset === EventType.ASSAIG) return 'Assaig nou';
    if (preset === EventType.ACTUACIO) return 'Actuació nova';
    return 'Nou esdeveniment';
  });

  saving = signal(false);
  errorMessage = signal<string | null>(null);
  /** Null until loaded (or if loading fails): the date is then left to the API to validate. */
  private readonly seasons = signal<Season[] | null>(null);

  /** The event's season is derived from its date: a new or changed date must fall inside a season. */
  private readonly dateInSeasonValidator = (ctrl: AbstractControl): ValidationErrors | null => {
    const seasons = this.seasons();
    const date = ctrl.value as string | null;
    if (!seasons || !date || this.isUnchangedDate(date)) return null;
    return findSeasonForDate(date, seasons) ? null : { outsideSeason: true };
  };

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    eventType: [EventType.ASSAIG, [Validators.required]],
    date: ['', [Validators.required, this.dateInSeasonValidator]],
    startTime: ['', [Validators.pattern(/^\d{2}:\d{2}$/)]],
    location: [''],
    locationUrl: [''],
    description: [''],
    information: [''],
    countsForStatistics: [true],
  });

  private readonly dateValue = toSignal(this.form.controls.date.valueChanges, { initialValue: '' });

  /** Which season the chosen date falls in, shown under the date field. */
  readonly dateHint = computed<string | undefined>(() => {
    const seasons = this.seasons();
    const date = this.dateValue();
    if (!seasons || !date) return undefined;
    const season = findSeasonForDate(date, seasons);
    if (season) return `Temporada: ${season.name}`;
    // An old event outside every season keeps its date editable as is; any other date shows the error instead.
    return this.isUnchangedDate(date) ? 'Sense temporada' : undefined;
  });

  ngOnInit() {
    this.seasonService.getAll().subscribe({
      next: (resp) => {
        this.seasons.set(resp.data);
        this.form.controls.date.updateValueAndValidity();
      },
      // Leave `seasons` null: the date check falls back to the API's 400, shown in the error alert.
      error: () => this.seasons.set(null),
    });
    this.patchFormFromEvent();
  }

  ngOnChanges() {
    this.patchFormFromEvent();
  }

  private isUnchangedDate(date: string): boolean {
    const ev = this.event();
    return ev !== null && toDateOnly(ev.date) === date.slice(0, 10);
  }

  private patchFormFromEvent() {
    const ev = this.event();
    if (ev) {
      this.form.get('eventType')?.enable();
      this.form.patchValue({
        title: ev.title,
        eventType: ev.eventType,
        date: toDateOnly(ev.date),
        startTime: ev.startTime ?? '',
        location: ev.location ?? '',
        locationUrl: ev.locationUrl ?? '',
        description: ev.description ?? '',
        information: ev.information ?? '',
        countsForStatistics: ev.countsForStatistics,
      });
    } else {
      const preset = this.presetEventType();
      const defaultTitle = preset === EventType.ASSAIG ? 'Assaig general'
        : '';
      this.form.reset({
        title: defaultTitle,
        eventType: preset ?? EventType.ASSAIG,
        countsForStatistics: true,
      });
      if (preset) {
        this.form.get('eventType')?.disable();
      } else {
        this.form.get('eventType')?.enable();
      }
    }
  }

  onSubmit() {
    if (this.form.invalid || this.saving()) return;

    const raw = this.form.getRawValue();
    const payload: CreateEventPayload = {
      title: raw.title!,
      eventType: raw.eventType as EventType,
      date: raw.date!,
      ...(raw.startTime ? { startTime: raw.startTime } : {}),
      ...(raw.location ? { location: raw.location } : {}),
      ...(raw.locationUrl ? { locationUrl: raw.locationUrl } : {}),
      ...(raw.description ? { description: raw.description } : {}),
      ...(raw.information ? { information: raw.information } : {}),
      countsForStatistics: raw.countsForStatistics ?? true,
    };

    this.saving.set(true);
    this.errorMessage.set(null);

    const ev = this.event();
    const request$ = ev
      ? this.eventService.updateFull(ev.id, this.buildUpdatePayload(raw))
      : this.eventService.create(payload);

    request$.subscribe({
      next: (result) => {
        this.saving.set(false);
        this.saved.emit(result);
      },
      error: (err) => {
        this.saving.set(false);
        const message = err?.error?.message ?? 'Error en desar l\'esdeveniment';
        this.errorMessage.set(Array.isArray(message) ? message.join(', ') : message);
      },
    });
  }

  private buildUpdatePayload(raw: ReturnType<typeof this.form.getRawValue>): UpdateEventPayload {
    const orNull = (value: string | null | undefined): string | null => {
      const trimmed = (value ?? '').trim();
      return trimmed.length > 0 ? trimmed : null;
    };
    return {
      title: raw.title!,
      eventType: raw.eventType as EventType,
      date: raw.date!,
      startTime: orNull(raw.startTime),
      location: orNull(raw.location),
      locationUrl: orNull(raw.locationUrl),
      description: orNull(raw.description),
      information: orNull(raw.information),
      countsForStatistics: raw.countsForStatistics ?? true,
    };
  }

  onClose() {
    this.closed.emit();
  }

  fieldError(controlName: string): string | null {
    const ctrl = this.form.get(controlName) as AbstractControl;
    if (!ctrl || !ctrl.invalid) return null;
    // Shown as soon as a date is picked, not on blur: it explains why the save button is disabled.
    if (ctrl.errors?.['outsideSeason'] && (ctrl.dirty || ctrl.touched)) return 'Esta data no és dins de cap temporada.';
    if (!ctrl.touched) return null;
    if (ctrl.errors?.['required']) return 'Camp obligatori';
    if (ctrl.errors?.['maxlength']) return `Màxim ${ctrl.errors['maxlength'].requiredLength} caràcters`;
    if (ctrl.errors?.['pattern']) return 'Format incorrecte';
    return 'Valor invàlid';
  }
}

function toDateOnly(date: string | Date): string {
  return typeof date === 'string' ? date.slice(0, 10) : new Date(date).toISOString().slice(0, 10);
}
