import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="stat bg-base-100 rounded-xl shadow-sm">
      @if (icon()) {
        <div class="stat-figure text-primary">
          <span class="text-3xl">{{ icon() }}</span>
        </div>
      }
      <div class="stat-title">{{ label() }}</div>
      <div class="stat-value text-primary">{{ value() }}</div>
      @if (description()) {
        <div class="stat-desc">{{ description() }}</div>
      }
    </div>
  `,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  description = input<string | null>(null);
  icon = input<string | null>(null);
}
