import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-already-assigned-dialog',
  standalone: true,
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

          <div class="modal-action">
            <button type="button" class="btn btn-ghost btn-sm" (click)="closed.emit()">
              Cancel·lar
            </button>
            <button type="button" class="btn btn-outline btn-sm" (click)="viewRequested.emit()">
              Anar-hi
            </button>
            <button
              #reassignButton
              type="button"
              class="btn btn-primary btn-sm"
              autofocus
              (click)="reassignRequested.emit()"
            >
              Reassignar ací
            </button>
          </div>
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

  readonly closed = output<void>();
  readonly viewRequested = output<void>();
  readonly reassignRequested = output<void>();

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
