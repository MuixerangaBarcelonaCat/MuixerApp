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
import { ReactiveFormsModule, FormBuilder, Validators, AbstractControl } from '@angular/forms';
import { EventService } from '../../services/event.service';
import { EventDetail, Season, CreateEventPayload, UpdateEventPayload, EventType } from '../../models/event.model';

@Component({
  selector: 'app-event-form-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './event-form-modal.component.html',
})
export class EventFormModalComponent implements OnInit, OnChanges {
  private readonly fb = inject(FormBuilder);
  private readonly eventService = inject(EventService);

  readonly EventType = EventType;

  event = input<EventDetail | null>(null);
  seasons = input<Season[]>([]);

  saved = output<EventDetail>();
  closed = output<void>();

  isEditMode = computed(() => this.event() !== null);
  modalTitle = computed(() => this.isEditMode() ? 'Editar esdeveniment' : 'Nou esdeveniment');

  saving = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    eventType: [EventType.ASSAIG, [Validators.required]],
    date: ['', [Validators.required]],
    startTime: ['', [Validators.pattern(/^\d{2}:\d{2}$/)]],
    location: [''],
    locationUrl: [''],
    description: [''],
    information: [''],
    countsForStatistics: [true],
    seasonId: [''],
  });

  ngOnInit() {
    this.patchFormFromEvent();
  }

  ngOnChanges() {
    this.patchFormFromEvent();
  }

  private patchFormFromEvent() {
    const ev = this.event();
    if (ev) {
      this.form.patchValue({
        title: ev.title,
        eventType: ev.eventType,
        date: typeof ev.date === 'string' ? ev.date.slice(0, 10) : new Date(ev.date).toISOString().slice(0, 10),
        startTime: ev.startTime ?? '',
        location: ev.location ?? '',
        locationUrl: ev.locationUrl ?? '',
        description: ev.description ?? '',
        information: ev.information ?? '',
        countsForStatistics: ev.countsForStatistics,
        seasonId: ev.season?.id ?? '',
      });
    } else {
      this.form.reset({
        eventType: EventType.ASSAIG,
        countsForStatistics: true,
      });
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
      ...(raw.seasonId ? { seasonId: raw.seasonId } : {}),
    };

    this.saving.set(true);
    this.errorMessage.set(null);

    const ev = this.event();
    const request$ = ev
      ? this.eventService.updateFull(ev.id, payload as UpdateEventPayload)
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

  onClose() {
    this.closed.emit();
  }

  fieldError(controlName: string): string | null {
    const ctrl = this.form.get(controlName) as AbstractControl;
    if (!ctrl || !ctrl.invalid || !ctrl.touched) return null;
    if (ctrl.errors?.['required']) return 'Camp obligatori';
    if (ctrl.errors?.['maxlength']) return `Màxim ${ctrl.errors['maxlength'].requiredLength} caràcters`;
    if (ctrl.errors?.['pattern']) return 'Format incorrecte';
    return 'Valor invàlid';
  }
}
