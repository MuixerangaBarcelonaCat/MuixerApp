import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { LucideAngularModule, CheckCircle, AlertCircle, Info } from 'lucide-angular';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div
      class="fixed top-4 inset-x-4 z-[9999] flex flex-col gap-2"
      style="padding-top: env(safe-area-inset-top, 0px)"
      aria-live="polite"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="alert shadow-lg text-sm py-2 animate-slide-in"
          [class.alert-success]="toast.type === 'success'"
          [class.alert-error]="toast.type === 'error'"
          [class.alert-info]="toast.type === 'info'"
          role="status"
        >
          @switch (toast.type) {
            @case ('success') {
              <lucide-icon [img]="CheckCircle" [size]="16" />
            }
            @case ('error') {
              <lucide-icon [img]="AlertCircle" [size]="16" />
            }
            @case ('info') {
              <lucide-icon [img]="Info" [size]="16" />
            }
          }
          <span>{{ toast.message }}</span>
          <button
            class="btn btn-ghost btn-xs"
            (click)="toastService.dismiss(toast.id)"
            aria-label="Tancar"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    .animate-slide-in {
      animation: slideIn 0.2s ease-out;
    }
    @keyframes slideIn {
      from {
        transform: translateY(-1rem);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `,
})
export class ToastContainerComponent {
  protected readonly toastService = inject(ToastService);
  protected readonly CheckCircle = CheckCircle;
  protected readonly AlertCircle = AlertCircle;
  protected readonly Info = Info;
}
