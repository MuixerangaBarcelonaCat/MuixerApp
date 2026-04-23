import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body items-center text-center py-12">
        @if (icon()) {
          <lucide-icon [name]="icon()!" [size]="48" class="text-base-content/30 mb-2" />
        }
        <p class="text-base-content/60 text-sm">{{ message() }}</p>
        @if (actionLabel()) {
          <button class="btn btn-primary btn-sm mt-4" (click)="actionClick.emit()" type="button">
            {{ actionLabel() }}
          </button>
        }
      </div>
    </div>
  `,
})
export class EmptyStateComponent {
  icon = input<string | null>(null);
  message = input.required<string>();
  actionLabel = input<string | null>(null);
  actionClick = output<void>();
}
