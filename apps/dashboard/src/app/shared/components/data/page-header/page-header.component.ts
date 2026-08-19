import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { BadgeComponent } from '@muixer/ui';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold font-serif text-base-content">{{ title() }}</h1>
        @if (count() !== null && count() !== undefined) {
          <lib-badge variant="neutral" size="lg">{{ count() }}</lib-badge>
        }
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <ng-content />
      </div>
    </div>
  `,
})
export class PageHeaderComponent {
  title = input.required<string>();
  count = input<number | null>(null);
}
