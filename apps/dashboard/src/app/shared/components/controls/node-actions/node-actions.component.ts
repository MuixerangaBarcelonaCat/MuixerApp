import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';

@Component({
  selector: 'app-node-actions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  template: `
    <div
      role="toolbar"
      aria-label="Accions del node"
      class="flex items-center gap-1.5"
    >
      <div class="flex-1 flex">
        <lib-button
          variant="ghost"
          size="md"
          fullWidth
          [disabled]="!canDuplicate()"
          (clicked)="duplicate.emit()"
          ariaLabel="Duplica el node seleccionat"
          data-testid="node-action-duplicate"
        >
          <span class="flex flex-col items-center gap-0.5 leading-none py-1">
            <lucide-icon name="Copy" [size]="14" aria-hidden="true" />
            <span class="text-[11px]">Duplica</span>
          </span>
        </lib-button>
      </div>

      <div class="flex-1 flex">
        <lib-button
          variant="ghost"
          size="md"
          fullWidth
          [disabled]="!canGhost()"
          (clicked)="ghost.emit()"
          [ariaLabel]="canGhost() ? 'Dupica el node darrere del seleccionat' : 'Només disponible per a nodes PINYA exteriors de rengla'"
          data-testid="node-action-ghost"
        >
          <span class="flex flex-col items-center gap-0.5 leading-none py-1">
            <lucide-icon name="Ghost" [size]="14" aria-hidden="true" />
            <span class="text-[11px]">Estén rengla</span>
          </span>
        </lib-button>
      </div>

      <div class="flex-1 flex">
        <lib-button
          variant="error"
          outline
          size="md"
          fullWidth
          [disabled]="!canDelete()"
          (clicked)="nodeDeleted.emit()"
          ariaLabel="Elimina el node seleccionat"
          data-testid="node-action-delete"
        >
          <span class="flex flex-col items-center gap-0.5 leading-none py-1">
            <lucide-icon name="Trash2" [size]="14" aria-hidden="true" />
            <span class="text-[11px]">Elimina</span>
          </span>
        </lib-button>
      </div>
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
