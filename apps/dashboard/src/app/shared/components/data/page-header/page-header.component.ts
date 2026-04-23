import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-2">
        <h1 class="text-xl font-bold text-base-content">{{ title() }}</h1>
        @if (count() !== null && count() !== undefined) {
          <span class="badge badge-neutral badge-lg font-semibold">{{ count() }}</span>
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
