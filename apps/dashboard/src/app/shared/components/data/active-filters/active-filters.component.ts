import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { BadgeComponent } from '@muixer/ui';

export interface ActiveFilter {
  key: string;
  label: string;
}

@Component({
  selector: 'app-active-filters',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  // display:contents, not 'block' — when there are no active filters this renders nothing, but
  // a 'block' host is still a real (empty) box, and a flex sibling's justify-between then treats
  // that empty box as the "first" item and shoves the real content (e.g. person-list's column
  // toggle) to the far end. contents makes an empty render truly disappear from the flex layout.
  host: { class: 'contents' },
  template: `
    @if (filters().length > 0) {
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-xs text-base-content/50 font-medium">Filtres actius:</span>
        @for (filter of filters(); track filter.key) {
          <lib-badge outline>
            <span class="inline-flex items-center gap-1.5">
              {{ filter.label }}
              <button
                type="button"
                class="cursor-pointer hover:text-error transition-colors min-h-6 min-w-6 inline-flex items-center justify-center"
                (click)="removeFilter.emit(filter.key)"
                [attr.aria-label]="'Treure filtre ' + filter.label"
              >✕</button>
            </span>
          </lib-badge>
        }
      </div>
    }
  `,
})
export class ActiveFiltersComponent {
  filters = input.required<ActiveFilter[]>();
  removeFilter = output<string>();
}
