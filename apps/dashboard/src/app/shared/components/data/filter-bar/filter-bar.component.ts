import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { ButtonComponent } from '@muixer/ui';

@Component({
  selector: 'app-filter-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent],
  host: { class: 'block' },
  template: `
    <div class="card bg-base-100 shadow-raised">
      <div class="card-body p-4">
        <div class="flex flex-wrap items-end gap-3">
          <ng-content />
          @if (hasActiveFilters()) {
            <lib-button variant="ghost" size="sm" (clicked)="clearFilters.emit()">Neteja filtres</lib-button>
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
