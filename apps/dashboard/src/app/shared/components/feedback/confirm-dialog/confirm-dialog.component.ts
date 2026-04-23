import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { NgClass } from '@angular/common';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  host: { class: 'block' },
  template: `
    <dialog class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">{{ title() }}</h3>
        <p class="py-4 text-base-content/70">{{ message() }}</p>
        <div class="modal-action">
          <button class="btn btn-ghost" type="button" (click)="cancelled.emit()">
            Cancel·lar
          </button>
          <button
            class="btn"
            [ngClass]="confirmClass()"
            type="button"
            (click)="confirmed.emit()"
          >
            {{ confirmLabel() }}
          </button>
        </div>
      </div>
      <button class="modal-backdrop" type="button" aria-label="Tancar" (click)="cancelled.emit()"></button>
    </dialog>
  `,
})
export class ConfirmDialogComponent {
  title = input.required<string>();
  message = input.required<string>();
  confirmLabel = input('Confirmar');
  confirmClass = input('btn-error');

  confirmed = output<void>();
  cancelled = output<void>();
}
