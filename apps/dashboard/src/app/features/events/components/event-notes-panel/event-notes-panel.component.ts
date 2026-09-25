import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { LucideAngularModule, ChevronDown, ChevronRight } from 'lucide-angular';
import { AlertComponent, ButtonComponent, CardComponent, TextareaComponent, ToastService } from '@muixer/ui';
import { EventService } from '../../services/event.service';

/**
 * Shared across every event on purpose: a technician who works with the notes open wants them
 * open on the next event too.
 */
export const NOTES_EXPANDED_STORAGE_KEY = 'muixer_event_notes_expanded';

const readStoredExpanded = (): boolean => {
  try {
    return localStorage.getItem(NOTES_EXPANDED_STORAGE_KEY) === 'true';
  } catch {
    // localStorage unavailable (private mode) — the panel just starts collapsed every time.
    return false;
  }
};

/**
 * Notes internes d'un esdeveniment: un bloc de text lliure per a la tècnica, plegat per
 * defecte i editable in situ. No té res a veure amb `information`, que els membres veuen a la PWA.
 */
@Component({
  selector: 'app-event-notes-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    LucideAngularModule,
    CardComponent,
    AlertComponent,
    ButtonComponent,
    TextareaComponent,
  ],
  templateUrl: './event-notes-panel.component.html',
})
export class EventNotesPanelComponent {
  readonly eventId = input.required<string>();
  readonly notes = input<string | null>(null);

  /** The value that was just persisted, so the page can update without refetching the event. */
  readonly saved = output<string | null>();

  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);

  protected readonly ChevronDown = ChevronDown;
  protected readonly ChevronRight = ChevronRight;

  protected readonly expanded = signal(readStoredExpanded());
  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly control = new FormControl<string>('', { nonNullable: true });

  /** Last known persisted text — resets when the event changes, and after a successful save. */
  private readonly baseline = linkedSignal<string>(() => this.notes() ?? '');
  private readonly draft = signal('');

  protected readonly dirty = computed(() => this.draft() !== this.baseline());

  constructor() {
    this.control.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => this.draft.set(value));
    effect(() => this.control.setValue(this.baseline()));
  }

  protected toggle(): void {
    const next = !this.expanded();
    this.expanded.set(next);
    try {
      localStorage.setItem(NOTES_EXPANDED_STORAGE_KEY, String(next));
    } catch {
      // Persisting the preference is best-effort; the panel still works without it.
    }
  }

  protected cancel(): void {
    this.control.setValue(this.baseline());
    this.error.set(null);
  }

  protected save(): void {
    const trimmed = this.draft().trim();
    const value = trimmed.length > 0 ? trimmed : null;

    this.saving.set(true);
    this.error.set(null);
    this.eventService.updateFull(this.eventId(), { notes: value }).subscribe({
      next: () => {
        this.saving.set(false);
        this.baseline.set(trimmed);
        this.saved.emit(value);
        this.toast.success('S\'han alçat les notes.');
      },
      error: () => {
        this.saving.set(false);
        this.error.set('No s\'han pogut alçar les notes.');
      },
    });
  }
}
