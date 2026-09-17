import { ChangeDetectionStrategy, Component, inject, output, signal } from '@angular/core';
import { CordonsResponse } from '@muixer/pinyes-render';
import { ButtonComponent, ModalComponent, ToastService } from '@muixer/ui';
import { NodeAssignmentService } from '../../services/node-assignment.service';

interface PendingCordonsChange {
  instanceId: string;
  numberOfCordons: number | null;
  affectedCount: number;
}

/**
 * Single shared "reduce the number of cordons, warn first if it would unassign people" flow,
 * used by both the Distribució tab and the segment list — previewed against the real backend
 * impact (`NodeAssignmentService.previewCordonsImpact`, which shares `hiddenNodeIdsBeyondCordons`
 * with the actual removal on `updateCordons`) so the count shown here can never diverge from
 * what's actually removed. `numberOfCordons: null` ("Tots") is always safe and applies directly.
 */
@Component({
  selector: 'app-cordons-change',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModalComponent, ButtonComponent],
  templateUrl: './cordons-change.component.html',
})
export class CordonsChangeComponent {
  /** Emits the backend response once a cordons change has actually been applied. */
  readonly changed = output<CordonsResponse>();

  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);

  readonly pending = signal<PendingCordonsChange | null>(null);
  readonly saving = signal(false);

  request(instanceId: string, numberOfCordons: number | null): void {
    if (numberOfCordons === null) {
      this.apply(instanceId, numberOfCordons);
      return;
    }

    this.nodeAssignmentService.previewCordonsImpact(instanceId, numberOfCordons).subscribe({
      next: ({ affectedCount }) => {
        if (affectedCount > 0) {
          this.pending.set({ instanceId, numberOfCordons, affectedCount });
        } else {
          this.apply(instanceId, numberOfCordons);
        }
      },
      error: () => this.toast.error("Error en comprovar l'impacte de reduir els cordons."),
    });
  }

  confirm(): void {
    const pending = this.pending();
    if (!pending) return;
    this.saving.set(true);
    this.apply(pending.instanceId, pending.numberOfCordons, () => {
      this.saving.set(false);
      this.pending.set(null);
    });
  }

  cancel(): void {
    this.pending.set(null);
  }

  private apply(instanceId: string, numberOfCordons: number | null, onDone?: () => void): void {
    this.nodeAssignmentService.updateCordons(instanceId, { numberOfCordons }).subscribe({
      next: (result) => {
        if (result.removedAssignments > 0) {
          this.toast.warning(
            result.removedAssignments === 1
              ? "S'ha desassignat 1 persona que quedava fora dels cordons."
              : `S'han desassignat ${result.removedAssignments} persones que quedaven fora dels cordons.`,
          );
        }
        this.changed.emit(result);
        onDone?.();
      },
      error: () => {
        this.toast.error('Error en actualitzar els cordons.');
        onDone?.();
      },
    });
  }
}
