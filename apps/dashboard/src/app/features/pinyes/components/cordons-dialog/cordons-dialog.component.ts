import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  output,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { LucideAngularModule, Minus, Plus } from 'lucide-angular';
import { RenglaItem } from '../../models/figure-template.model';

export interface CordonsDialogSaveEvent {
  numberOfCordons: number | null;
  openCordons: string[];
}

@Component({
  selector: 'app-cordons-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, CdkTrapFocus],
  template: `
    @if (open()) {
      <dialog
        class="modal modal-open"
        role="dialog"
        aria-labelledby="cordons-dialog-title"
        aria-modal="true"
      >
        <div class="modal-box max-w-sm" cdkTrapFocus cdkTrapFocusAutoCapture>
          <h3 id="cordons-dialog-title" class="text-lg font-bold mb-4">Configuració de cordons</h3>

          <div class="form-control mb-4">
            <label class="label" for="cordons-count">
              <span class="label-text font-medium">Cordons visibles</span>
            </label>
            <div class="flex items-center gap-3">
              <button
                type="button"
                class="btn btn-sm btn-outline btn-square"
                [disabled]="localCordons() !== null && localCordons()! <= 1"
                (click)="decrement()"
                aria-label="Reduir cordons"
              >
                <i-lucide [img]="Minus" class="size-4" />
              </button>
              <span class="text-lg font-semibold min-w-[3rem] text-center" aria-live="polite">
                {{ localCordons() === null ? 'Tots' : localCordons() }}
              </span>
              <button
                type="button"
                class="btn btn-sm btn-outline btn-square"
                [disabled]="localCordons() !== null && localCordons()! >= maxCordons()"
                (click)="increment()"
                aria-label="Augmentar cordons"
              >
                <i-lucide [img]="Plus" class="size-4" />
              </button>
              <button
                type="button"
                class="btn btn-sm btn-ghost"
                [class.btn-active]="localCordons() === null"
                (click)="setAll()"
              >
                Tots
              </button>
            </div>
            <p class="text-xs text-base-content/50 mt-1">
              Mostra els nodes fins al cordó seleccionat.
            </p>
          </div>

          @if (rengles().length > 0) {
            <div class="divider my-2"></div>
            <div class="form-control">
              <span class="label" id="cordo-obert-label">
                <span class="label-text font-medium">Cordó obert</span>
              </span>
              <div class="space-y-2 max-h-48 overflow-y-auto">
                @for (rengla of rengles(); track rengla.id) {
                  <label class="flex items-center gap-3 cursor-pointer px-2 py-1.5 rounded hover:bg-base-200 transition-colors">
                    <input
                      type="checkbox"
                      class="checkbox checkbox-sm checkbox-primary"
                      [checked]="isRenglaOpen(rengla.id)"
                      (change)="toggleRengla(rengla.id)"
                      [attr.aria-label]="'Cordó obert per ' + rengla.name"
                    />
                    <span class="text-sm">{{ rengla.name }}</span>
                  </label>
                }
              </div>
            </div>
          }

          <div class="modal-action mt-6">
            <button
              type="button"
              class="btn btn-ghost btn-sm"
              (click)="onCancel()"
            >
              Cancel·lar
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              (click)="onSave()"
            >
              Desar
            </button>
          </div>
        </div>
        <button type="button" class="modal-backdrop" (click)="onCancel()" aria-label="Tancar"></button>
      </dialog>
    }
  `,
})
export class CordonsDialogComponent {
  readonly open = input.required<boolean>();
  readonly numberOfCordons = input.required<number | null>();
  readonly openCordons = input.required<string[]>();
  readonly rengles = input.required<RenglaItem[]>();
  readonly maxCordons = input.required<number>();

  readonly saved = output<CordonsDialogSaveEvent>();
  readonly closed = output<void>();

  readonly Minus = Minus;
  readonly Plus = Plus;

  readonly localCordons = linkedSignal(() => this.numberOfCordons());
  readonly localOpenCordons = linkedSignal(() => [...(this.openCordons() ?? [])]);

  readonly hasChanges = computed(() => {
    return (
      this.localCordons() !== this.numberOfCordons() ||
      JSON.stringify(this.localOpenCordons().sort()) !== JSON.stringify([...(this.openCordons() ?? [])].sort())
    );
  });

  decrement(): void {
    const current = this.localCordons();
    if (current === null) {
      this.localCordons.set(this.maxCordons() - 1 || 1);
    } else if (current > 1) {
      this.localCordons.set(current - 1);
    }
  }

  increment(): void {
    const current = this.localCordons();
    if (current === null) return;
    if (current < this.maxCordons()) {
      this.localCordons.set(current + 1);
    }
  }

  setAll(): void {
    this.localCordons.set(null);
  }

  isRenglaOpen(renglaId: string): boolean {
    return this.localOpenCordons().includes(renglaId);
  }

  toggleRengla(renglaId: string): void {
    this.localOpenCordons.update((list) =>
      list.includes(renglaId)
        ? list.filter((id) => id !== renglaId)
        : [...list, renglaId],
    );
  }

  onSave(): void {
    this.saved.emit({
      numberOfCordons: this.localCordons(),
      openCordons: this.localOpenCordons(),
    });
  }

  onCancel(): void {
    this.closed.emit();
  }
}
