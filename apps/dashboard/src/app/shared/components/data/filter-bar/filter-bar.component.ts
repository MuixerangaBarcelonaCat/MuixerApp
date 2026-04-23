import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="card bg-base-100 shadow-sm">
      <div class="card-body p-4">
        <div class="flex flex-wrap items-end gap-3">
          <ng-content />
          @if (hasActiveFilters()) {
            <button
              type="button"
              class="btn btn-ghost btn-sm text-base-content/60"
              (click)="clearFilters.emit()"
            >
              Netejar filtres
            </button>
          }
        </div>
      </div>
    </div>
  `,
})
export class FilterBarComponent {
  hasActiveFilters = input(false);
  clearFilters = output<void>();
}
