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
import { HttpErrorResponse } from '@angular/common/http';
import { AttendanceStatus } from '@muixer/shared';
import { EventService } from '../../services/event.service';
import { ButtonComponent, ButtonGroupComponent, ToastService } from '@muixer/ui';

@Component({
  selector: 'app-attendance-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent],
  template: `
    @if (isLocked()) {
      <span class="badge badge-info badge-sm gap-1 py-3">
        <svg xmlns="http://www.w3.org/2000/svg" class="size-3" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
        </svg>
        He assistit
      </span>
    } @else {
      <lib-button-group>
        <lib-button
          joinItem
          size="xs"
          [variant]="displayStatus() === ANIRE ? 'success' : 'neutral'"
          [active]="displayStatus() === ANIRE"
          [loading]="isPending() && displayStatus() === ANIRE"
          [disabled]="isEffectivelyDisabled()"
          [ariaPressed]="displayStatus() === ANIRE"
          [ariaLabel]="ariaLabelFor(ANIRE)"
          (clicked)="setStatus(ANIRE)"
        >Vinc</lib-button>
        <lib-button
          joinItem
          size="xs"
          [variant]="displayStatus() === NO_VAIG ? 'error' : 'neutral'"
          [active]="displayStatus() === NO_VAIG"
          [loading]="isPending() && displayStatus() === NO_VAIG"
          [disabled]="isEffectivelyDisabled()"
          [ariaPressed]="displayStatus() === NO_VAIG"
          [ariaLabel]="ariaLabelFor(NO_VAIG)"
          (clicked)="setStatus(NO_VAIG)"
        >No vinc</lib-button>
      </lib-button-group>
    }
  `,
})
export class AttendanceButtonComponent {
  readonly status = input<AttendanceStatus | null>(null);
  readonly eventId = input.required<string>();
  readonly personId = input<string | undefined>(undefined);
  readonly disabled = input(false);
  readonly ariaContext = input('');
  readonly statusChanged = output<AttendanceStatus>();

  protected readonly ANIRE = AttendanceStatus.ANIRE;
  protected readonly NO_VAIG = AttendanceStatus.NO_VAIG;

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
    () => this.disabled() || this.isPending(),
  );
  private static readonly STATUS_LABELS: Record<AttendanceStatus, string> = {
    [AttendanceStatus.ANIRE]: 'Vinc',
    [AttendanceStatus.NO_VAIG]: 'No vinc',
    [AttendanceStatus.PENDENT]: 'Pendent',
    [AttendanceStatus.ASSISTIT]: 'He assistit',
  };

  /**
   * Per-button accessible name — `lib-button-group` is a pure layout wrapper with no group-level
   * `aria-label` of its own, so each segment carries its own full context (matching how the
   * roll-call status segments do it too) rather than relying on an outer group label.
   */
  protected ariaLabelFor(status: AttendanceStatus): string {
    const ctx = this.ariaContext();
    const label = AttendanceButtonComponent.STATUS_LABELS[status];
    return ctx ? `Assistència ${ctx}: ${label}` : `Assistència: ${label}`;
  }

  setStatus(target: AttendanceStatus): void {
    if (this.isEffectivelyDisabled()) return;

    const current = this.localStatus() ?? AttendanceStatus.PENDENT;
    const previous = current;
    const next = target === current ? AttendanceStatus.PENDENT : target;
    this.localStatus.set(next);
    this.isPending.set(true);

    this.eventService.updateAttendance(this.eventId(), next, this.personId()).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.statusChanged.emit(next);
        this.isPending.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.localStatus.set(previous);
        const serverMsg = err.error?.message;
        const msg = typeof serverMsg === 'string' && serverMsg.length > 0
          ? serverMsg
          : "No s'ha pogut actualitzar l'assistència.";
        this.toast.error(msg);
        this.isPending.set(false);
      },
    });
  }
}
