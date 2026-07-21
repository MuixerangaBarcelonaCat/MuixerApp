import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule, Calendar, LucideIconData } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center py-12 text-center" role="status">
      <lucide-icon
        [img]="icon()"
        [size]="48"
        class="text-base-content/30 mb-4"
        aria-hidden="true"
      />
      <p class="text-base-content/60 text-sm">{{ message() }}</p>
      @if (actionLabel()) {
        <button
          type="button"
          class="btn btn-sm btn-primary mt-4"
          (click)="action.emit()"
        >
          {{ actionLabel() }}
        </button>
      }
    </div>
  `,
})
export class EmptyStateComponent {
  icon = input<LucideIconData>(Calendar);
  message = input.required<string>();
  actionLabel = input<string | undefined>(undefined);
  action = output<void>();
}
