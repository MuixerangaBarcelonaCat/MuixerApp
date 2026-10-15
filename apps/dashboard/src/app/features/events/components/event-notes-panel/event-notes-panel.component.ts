import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { HttpErrorResponse, HttpStatusCode } from '@angular/common/http';
import { LucideAngularModule, ChevronDown, ChevronRight } from 'lucide-angular';
import { AlertComponent, ButtonComponent, CardComponent, ToastService } from '@muixer/ui';
import { MarkdownEditorComponent } from '@muixer/ui/markdown-editor';
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
    LucideAngularModule,
    CardComponent,
    AlertComponent,
    ButtonComponent,
    MarkdownEditorComponent,
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

  /** Last known persisted text — resets when the event changes, and after a successful save. */
  private readonly baseline = linkedSignal<string>(() => this.notes() ?? '');

  /** Re-seeds from `baseline`, so a save or a different event resets the editor's content. */
  protected readonly draft = linkedSignal<string>(() => this.baseline());

  protected readonly dirty = computed(() => this.draft() !== this.baseline());

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
    this.draft.set(this.baseline());
    this.error.set(null);
  }

  protected save(): void {
    const trimmed = this.draft().trim();
    const value = trimmed.length > 0 ? trimmed : null;

    this.saving.set(true);
    this.error.set(null);
    // `expectedNotes` lets the API refuse the save if another technician changed the notes since
    // they were loaded here, instead of silently overwriting their text.
    this.eventService.updateFull(this.eventId(), { notes: value, expectedNotes: this.baseline() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.baseline.set(trimmed);
        this.saved.emit(value);
        this.toast.success('S\'han alçat les notes.');
      },
      error: (err: unknown) => {
        this.saving.set(false);
        // The draft is left untouched in both cases, so nothing typed here is lost.
        const conflict = err instanceof HttpErrorResponse && err.status === HttpStatusCode.Conflict;
        this.error.set(
          conflict
            ? 'Algú altre ha modificat les notes. Copieu el text, recarregueu la pàgina i torneu a alçar-les.'
            : 'No s\'han pogut alçar les notes.',
        );
      },
    });
  }
}
