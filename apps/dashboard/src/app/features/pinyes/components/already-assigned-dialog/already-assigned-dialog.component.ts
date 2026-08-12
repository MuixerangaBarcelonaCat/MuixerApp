import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  computed,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ConflictPlacement } from '../../models/assignment.model';
import { ICON_OBSERVACIONS } from '../../../../shared/constants/domain-icons';

@Component({
  selector: 'app-already-assigned-dialog',
  standalone: true,
  imports: [LucideAngularModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <dialog class="modal modal-open" aria-labelledby="already-assigned-title" role="dialog">
        <div class="modal-box max-w-md">
          <h3 id="already-assigned-title" class="font-bold text-lg mb-2">Persona ja assignada</h3>

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
                  <span
                    class="badge badge-sm shrink-0"
                    [class.badge-conflict]="placement.area === 'TRONC'"
                    [class.badge-ghost]="placement.area !== 'TRONC'"
                  >
                    {{ areaLabel(placement.area) }}
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
              <p class="text-sm text-conflict flex items-start gap-1 mb-4">
                <lucide-icon [name]="ICON_CONFLICT" [size]="14" class="mt-0.5 shrink-0" />
                <span>Una d'estes col·locacions és al <strong>tronc</strong>: reubicar-la té conseqüències.</span>
              </p>
            }
          }

          <div class="flex flex-col gap-2 mt-6">
            <!-- Row 1: secondary actions -->
            <div class="flex gap-2">
              <button type="button" class="btn btn-ghost btn-sm" (click)="closed.emit()">
                Cancel·lar
              </button>
              <button type="button" class="btn btn-outline btn-sm" (click)="viewRequested.emit()">
                Veure col·locació
              </button>
              <!--
              D8 (docs/SEGMENTS_FLEXIBILITY.md): duplicating must never be one accidental click
              away — always this dialog, always styled as a warning, always the least prominent
              action. Smaller than "Moure ací" to maximise deliberateness. Fase 5 is what makes
              clicking it actually create the duplicate instead of being rejected by the backend.
              -->
              <button
                type="button"
                class="btn btn-conflict btn-outline btn-sm"
                (click)="assignAnywayRequested.emit()"
              >
                Assignar igualment
              </button>
            </div>
            <!-- Row 2: "Moure ací" is the habitual action — full width, most prominent. -->
            <button
              #reassignButton
              type="button"
              class="btn btn-primary btn-sm w-full"
              autofocus
              (click)="reassignRequested.emit()"
            >
              Moure ací
            </button>
          </div>
          @if (placements().length > 0) {
            <p class="text-xs text-conflict/80 mt-2">
              Quedarà assignada a {{ placements().length + 1 }} llocs d'este segment.
            </p>
          }
        </div>
        <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
        <div class="modal-backdrop" (click)="closed.emit()"></div>
      </dialog>
    }
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

  private readonly reassignButton = viewChild<ElementRef<HTMLButtonElement>>('reassignButton');

  constructor() {
    // The dialog is CSS-only (no native showModal()), so the `autofocus` attribute
    // doesn't reliably steal focus from whatever element (e.g. the person search
    // input) was focused when it opens. Without this, Enter keeps hitting the
    // previously-focused element instead of activating "Reassignar ací".
    effect(() => {
      if (this.open()) {
        this.reassignButton()?.nativeElement.focus();
      }
    });
  }
}
