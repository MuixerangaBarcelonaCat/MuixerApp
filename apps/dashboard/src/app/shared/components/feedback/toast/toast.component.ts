import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="toast toast-top toast-end z-[9999]" aria-live="polite">
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="alert shadow-lg"
          [class]="alertClass(toast.type)"
        >
          <span>{{ toast.message }}</span>
          <button
            type="button"
            class="btn btn-ghost btn-xs"
            (click)="toastService.remove(toast.id)"
            aria-label="Tancar notificació"
          >✕</button>
        </div>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);

  alertClass(type: string): string {
    const map: Record<string, string> = {
      success: 'alert-success',
      error: 'alert-error',
      warning: 'alert-warning',
      info: 'alert-info',
    };
    return map[type] ?? '';
  }
}
