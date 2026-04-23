import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';

export interface ActiveFilter {
  key: string;
  label: string;
}

@Component({
  selector: 'app-active-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @if (filters().length > 0) {
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-base-content/50 font-medium">Filtres actius:</span>
        @for (filter of filters(); track filter.key) {
          <div class="badge badge-outline gap-1.5">
            {{ filter.label }}
            <button
              type="button"
              class="cursor-pointer hover:text-error transition-colors"
              (click)="removeFilter.emit(filter.key)"
              [attr.aria-label]="'Treure filtre ' + filter.label"
            >✕</button>
          </div>
        }
      </div>
    }
  `,
})
export class ActiveFiltersComponent {
  filters = input.required<ActiveFilter[]>();
  removeFilter = output<string>();
}
