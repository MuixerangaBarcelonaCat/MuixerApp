import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  host: { class: 'block' },
  template: `
    <div class="stat bg-base-100 shadow-sm rounded-box p-3 lg:p-4">
      <div class="stat-figure" [class]="accentClass()">
        <lucide-icon [name]="icon()" [size]="22" />
      </div>
      <div class="stat-title text-xs font-medium">{{ label() }}</div>
      <div class="stat-value text-xl">{{ value() }}</div>
      @if (description()) {
        <div class="stat-desc text-xs mt-0.5">{{ description() }}</div>
      }
    </div>
  `,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input.required<string>();
  description = input<string>('');
  accentClass = input<string>('text-primary');
}
