import { ConflictPlacement } from '@muixer/pinyes-render';
import { Component, ChangeDetectionStrategy, computed, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_OBSERVACIONS } from '@muixer/shared';
import { ButtonComponent, ModalComponent, BadgeComponent } from '@muixer/ui';

@Component({
  selector: 'app-already-assigned-dialog',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent, ModalComponent, BadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <lib-modal [open]="open()" title="Persona ja assignada" (closed)="closed.emit()">
      <p class="text-sm text-base-content/70 mb-4">
        <strong>{{ personAlias() }}</strong> ja és <strong>{{ nodeLabel() }}</strong> a
        <strong>{{ figureName() }}</strong>.
      </p>

      @if (placements().length > 0) {
        <ul class="mb-4 flex flex-col gap-1">
          @for (placement of placements(); track placement.assignmentId) {
            <li
              data-conflict-placement
              class="flex items-center gap-2 text-sm rounded bg-base-200 px-2 py-1"
            >
              <!-- shrink-0 goes on this wrapper, not <lib-badge> itself: its display:contents
                   host renders no box of its own, so a layout class placed there is inert. -->
              <span class="shrink-0">
                <lib-badge [variant]="placement.area === 'TRONC' ? 'error' : 'ghost'" size="sm">
                  {{ areaLabel(placement.area) }}
                </lib-badge>
              </span>
              <span class="truncate">
                <strong>{{ placement.figureName }}</strong>
                @if (placement.nodeLabel) {
                  — {{ placement.nodeLabel }}
                }
              </span>
            </li>
          }
        </ul>

        @if (hasTronc()) {
          <p class="text-sm text-error flex items-start gap-1 mb-4">
            <lucide-icon [name]="ICON_CONFLICT" [size]="14" class="mt-0.5 shrink-0" />
            <span>Una d'estes col·locacions és al <strong>tronc</strong></span>
          </p>
        }
      }

      <div modalFooter class="w-full flex flex-col gap-2">
        <!-- Row 1: secondary actions -->
        <div class="flex gap-2">
          <lib-button variant="ghost" size="sm" (clicked)="closed.emit()">Cancel·lar</lib-button>
          <lib-button outline size="sm" (clicked)="viewRequested.emit()">Veure col·locació</lib-button>
          <!--
          D8 (docs/SEGMENTS_FLEXIBILITY.md): duplicating must never be one accidental click
          away — always this dialog, always styled as a warning, always the least prominent
          action. Smaller than "Moure ací" to maximise deliberateness. Fase 5 is what makes
          clicking it actually create the duplicate instead of being rejected by the backend.
          -->
          <lib-button variant="error" outline size="sm" (clicked)="assignAnywayRequested.emit()">
            Assignar igualment
          </lib-button>
        </div>
        <!-- Row 2: "Moure ací" is the habitual action — full width, most prominent.
             lib-button's own autofocus input replaces this component's old effect()+viewChild
             hack (no longer needed here — see lib-button's own doc entry for why it still needs
             one internally, unlike a plain native autofocus attribute). -->
        <lib-button variant="primary" size="sm" [fullWidth]="true" [autofocus]="true" (clicked)="reassignRequested.emit()">
          Moure ací
        </lib-button>
      </div>
    </lib-modal>
  `,
})
export class AlreadyAssignedDialogComponent {
  readonly open = input.required<boolean>();
  readonly personAlias = input.required<string>();
  readonly nodeLabel = input.required<string>();
  readonly figureName = input.required<string>();
  /**
   * All of this person's placements in the segment (Phase 3, informative only). When set, the
   * dialog lists them with their area and warns if any is a tronc. No new action is offered yet.
   */
  readonly placements = input<ConflictPlacement[]>([]);

  readonly closed = output<void>();
  readonly viewRequested = output<void>();
  readonly reassignRequested = output<void>();
  readonly assignAnywayRequested = output<void>();

  readonly ICON_CONFLICT = ICON_OBSERVACIONS;
  readonly hasTronc = computed(() => this.placements().some((p) => p.area === 'TRONC'));

  areaLabel(area: ConflictPlacement['area']): string {
    return area === 'TRONC' ? 'Tronc' : area === 'PINYA' ? 'Pinya' : 'Direcció';
  }
}
