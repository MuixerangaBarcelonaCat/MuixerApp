import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-node-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      role="toolbar"
      aria-label="Accions del node"
      class="flex items-center gap-1.5"
    >
      <button
        type="button"
        class="btn btn-sm btn-ghost flex-1"
        style="min-height: 44px;"
        [disabled]="!canDuplicate()"
        (click)="duplicate.emit()"
        aria-label="Duplica el node seleccionat"
        title="Duplica el node seleccionat"
        data-testid="node-action-duplicate"
      >
        <lucide-icon name="Copy" [size]="14" aria-hidden="true" />
        Duplica
      </button>

      <button
        type="button"
        class="btn btn-sm btn-ghost flex-1"
        style="min-height: 44px;"
        [disabled]="!canGhost()"
        (click)="ghost.emit()"
        aria-label="Crea un fantasma del node seleccionat"
        [title]="canGhost() ? 'Crea un fantasma del node' : 'Només disponible per a nodes PINYA exteriors de rengla'"
        data-testid="node-action-ghost"
      >
        <lucide-icon name="Ghost" [size]="14" aria-hidden="true" />
        Fantasma
      </button>

      <button
        type="button"
        class="btn btn-sm btn-outline btn-error flex-1"
        style="min-height: 44px;"
        [disabled]="!canDelete()"
        (click)="nodeDeleted.emit()"
        aria-label="Elimina el node seleccionat"
        title="Elimina el node seleccionat"
        data-testid="node-action-delete"
      >
        <lucide-icon name="Trash2" [size]="14" aria-hidden="true" />
        Elimina
      </button>
    </div>
  `,
})
export class NodeActionsComponent {
  /** True when a node is selected and can be duplicated */
  canDuplicate = input(false);
  /** True when the selected node can be deleted */
  canDelete = input(false);
  /** True when the selected node is eligible for ghost clone */
  canGhost = input(false);

  duplicate = output<void>();
  ghost = output<void>();
  nodeDeleted = output<void>();
}
