import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { FigureMode, InstanceDetail } from '@muixer/pinyes-render';
import { ButtonComponent, ModalComponent, ToastService } from '@muixer/ui';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { FigureInstanceService } from '../../services/figure-instance.service';

interface PendingFigureModeChange {
  eventId: string;
  segmentId: string;
  instanceId: string;
  label: string;
  mode: FigureMode;
  affectedCount: number;
}

/**
 * Single shared "change figureMode, warn first if it would unassign people" flow, used by
 * both the Distribució tab and the segment list — REMAT/NETA is previewed against the real
 * backend impact (`NodeAssignmentService.previewFigureModeImpact`, which shares its zone rules
 * with the actual deletion on `FigureInstanceService.update`) so the count shown here can never
 * diverge from what's actually removed. COMPLETA/PEU are never destructive and apply immediately.
 *
 * `eventId`/`segmentId` are passed per-`request()` call rather than as fixed inputs, since a
 * single page (the segment list) can host figures across several different segments at once.
 */
@Component({
  selector: 'app-figure-mode-change',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent],
  templateUrl: './figure-mode-change.component.html',
})
export class FigureModeChangeComponent {
  /** Emits the updated instance once a mode change has actually been applied. */
  readonly changed = output<InstanceDetail>();
  /** Emits the instanceId when a pending change is cancelled, so callers can resync any
   *  optimistic UI (e.g. a <select> whose native DOM already advanced to the rejected value). */
  readonly cancelled = output<string>();

  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly toast = inject(ToastService);

  readonly pending = signal<PendingFigureModeChange | null>(null);
  readonly saving = signal(false);

  request(eventId: string, segmentId: string, instanceId: string, label: string, mode: FigureMode): void {
    if (mode !== 'REMAT' && mode !== 'NETA') {
      this.apply(eventId, segmentId, instanceId, mode);
      return;
    }

    this.nodeAssignmentService.previewFigureModeImpact(instanceId, mode).subscribe({
      next: ({ affectedCount }) => {
        if (affectedCount > 0) {
          this.pending.set({ eventId, segmentId, instanceId, label, mode, affectedCount });
        } else {
          this.apply(eventId, segmentId, instanceId, mode);
        }
      },
      error: () => this.toast.error("Error en comprovar l'impacte del canvi de mode."),
    });
  }

  confirm(): void {
    const pending = this.pending();
    if (!pending) return;
    this.saving.set(true);
    this.apply(pending.eventId, pending.segmentId, pending.instanceId, pending.mode, () => {
      this.saving.set(false);
      this.pending.set(null);
    });
  }

  cancel(): void {
    const pending = this.pending();
    this.pending.set(null);
    if (pending) this.cancelled.emit(pending.instanceId);
  }

  private apply(eventId: string, segmentId: string, instanceId: string, mode: FigureMode, onDone?: () => void): void {
    this.instanceService.update(eventId, segmentId, instanceId, { figureMode: mode }).subscribe({
      next: (updated) => {
        this.changed.emit(updated);
        onDone?.();
      },
      error: () => {
        this.toast.error('Error en actualitzar el mode de la figura.');
        onDone?.();
      },
    });
  }
}
