import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  effect,
  inject,
} from '@angular/core';
import { AttendanceStatus } from '@muixer/shared';
import { EventService } from '../../services/event.service';
import { ToastService } from '../../../../shared/services/toast.service';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  [AttendanceStatus.ANIRE]: { label: 'Vinc', class: 'btn-success' },
  [AttendanceStatus.NO_VAIG]: { label: 'No vinc', class: 'btn-error' },
  [AttendanceStatus.PENDENT]: { label: 'Pendent', class: 'btn-warning' },
};

const STATUS_CYCLE: AttendanceStatus[] = [
  AttendanceStatus.ANIRE,
  AttendanceStatus.NO_VAIG,
  AttendanceStatus.PENDENT,
];

@Component({
  selector: 'app-attendance-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="btn btn-sm min-w-[5.5rem]"
      [class]="buttonClass()"
      [disabled]="disabled() || isPending()"
      [attr.aria-label]="'Assistència: ' + displayLabel()"
      aria-live="polite"
      (click)="toggle()"
    >
      @if (isPending()) {
        <span class="loading loading-spinner loading-xs"></span>
      }
      {{ displayLabel() }}
    </button>
  `,
})
export class AttendanceButtonComponent {
  readonly status = input<AttendanceStatus | null>(null);
  readonly eventId = input.required<string>();
  readonly disabled = input(false);
  readonly statusChanged = output<AttendanceStatus>();

  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);

  private readonly localStatus = signal<AttendanceStatus | null>(null);
  private readonly previousStatus = signal<AttendanceStatus | null>(null);
  protected readonly isPending = signal(false);

  protected readonly displayStatus = computed(
    () => this.localStatus() ?? AttendanceStatus.PENDENT,
  );
  protected readonly displayLabel = computed(
    () => STATUS_CONFIG[this.displayStatus()]?.label ?? 'Pendent',
  );
  protected readonly buttonClass = computed(
    () => STATUS_CONFIG[this.displayStatus()]?.class ?? 'btn-warning',
  );

  constructor() {
    effect(() => {
      this.localStatus.set(this.status());
    });
  }

  toggle(): void {
    if (this.disabled() || this.isPending()) return;

    const current = this.localStatus() ?? AttendanceStatus.PENDENT;
    const next = this.getNextStatus(current);
    this.previousStatus.set(current);
    this.localStatus.set(next);
    this.isPending.set(true);

    this.eventService.updateAttendance(this.eventId(), next).subscribe({
      next: () => {
        this.toast.success('Assistència actualitzada.');
        this.statusChanged.emit(next);
        this.isPending.set(false);
      },
      error: () => {
        this.localStatus.set(this.previousStatus());
        this.toast.error("No s'ha pogut actualitzar l'assistència.");
        this.isPending.set(false);
      },
    });
  }

  private getNextStatus(current: AttendanceStatus): AttendanceStatus {
    const idx = STATUS_CYCLE.indexOf(current);
    return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  }
}
