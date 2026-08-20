import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAngularModule, type LucideIconData } from 'lucide-angular';
import { CardComponent } from '@muixer/ui';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, CardComponent],
  host: { class: 'block' },
  template: `
    <lib-card>
      <div class="flex items-center gap-3">
        <div class="shrink-0" [class]="accentClass()">
          <lucide-icon [img]="icon()" [size]="22" />
        </div>
        <div class="min-w-0">
          <div class="text-xs font-medium text-base-content/60">{{ label() }}</div>
          <div class="text-xl font-bold">{{ value() }}</div>
          @if (description()) {
            <div class="text-xs text-base-content/50 mt-0.5">{{ description() }}</div>
          }
        </div>
      </div>
    </lib-card>
  `,
})
export class StatCardComponent {
  label = input.required<string>();
  value = input.required<string | number>();
  icon = input.required<LucideIconData>();
  description = input<string>('');
  accentClass = input<string>('text-primary');
}
