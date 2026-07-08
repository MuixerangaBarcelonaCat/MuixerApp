import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  input,
  output,
  signal,
  computed,
  inject,
  linkedSignal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AttendanceStatus } from '@muixer/shared';
import { EventService } from '../../services/event.service';
import { ToastService } from '../../../../shared/services/toast.service';

const STATUS_CONFIG: Record<string, { label: string; class: string }> = {
  [AttendanceStatus.ANIRE]: { label: 'Vinc', class: 'btn-success' },
  [AttendanceStatus.NO_VAIG]: { label: 'No vinc', class: 'btn-error' },
  [AttendanceStatus.PENDENT]: { label: 'Pendent', class: 'btn-warning' },
  [AttendanceStatus.ASSISTIT]: { label: 'He assistit', class: 'btn-info' },
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
      [disabled]="isEffectivelyDisabled()"
      [attr.aria-label]="ariaLabel()"
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
  readonly ariaContext = input('');
  readonly statusChanged = output<AttendanceStatus>();

  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly localStatus = linkedSignal(() => this.status());
  protected readonly isPending = signal(false);

  protected readonly displayStatus = computed(
    () => this.localStatus() ?? AttendanceStatus.PENDENT,
  );
  protected readonly isLocked = computed(
    () => this.displayStatus() === AttendanceStatus.ASSISTIT,
  );
  protected readonly isEffectivelyDisabled = computed(
    () => this.disabled() || this.isPending() || this.isLocked(),
  );
  protected readonly displayLabel = computed(
    () => STATUS_CONFIG[this.displayStatus()]?.label ?? 'Pendent',
  );
  protected readonly buttonClass = computed(
    () => STATUS_CONFIG[this.displayStatus()]?.class ?? 'btn-warning',
  );
  protected readonly ariaLabel = computed(() => {
    const ctx = this.ariaContext();
    const label = this.displayLabel();
    return ctx ? `Assistència ${ctx}: ${label}` : `Assistència: ${label}`;
  });

  toggle(): void {
    if (this.isEffectivelyDisabled()) return;

    const current = this.localStatus() ?? AttendanceStatus.PENDENT;
    const previous = current;
    const next = this.getNextStatus(current);
    this.localStatus.set(next);
    this.isPending.set(true);

    this.eventService.updateAttendance(this.eventId(), next).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.toast.success('Assistència actualitzada.');
        this.statusChanged.emit(next);
        this.isPending.set(false);
      },
      error: () => {
        this.localStatus.set(previous);
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
