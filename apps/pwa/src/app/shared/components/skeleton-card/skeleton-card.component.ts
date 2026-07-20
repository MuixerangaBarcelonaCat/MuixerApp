import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-skeleton-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (_ of items(); track $index) {
      <div
        class="card bg-base-100 shadow-sm animate-pulse"
        role="status"
        aria-busy="true"
        aria-label="S'està carregant el contingut"
      >
        <div class="card-body p-4 space-y-2">
          <div class="h-4 bg-base-300 rounded w-3/4"></div>
          <div class="h-3 bg-base-300 rounded w-1/2"></div>
          <div class="h-8 bg-base-300 rounded w-24 mt-2"></div>
        </div>
      </div>
    }
  `,
})
export class SkeletonCardComponent {
  count = input(3);

  protected items = () => Array.from({ length: this.count() });
}
