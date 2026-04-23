import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { ColumnDef } from '../../../models/column-def.model';

@Component({
  selector: 'app-column-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <div class="collapse collapse-arrow bg-base-200/50 rounded-lg border border-base-300">
      <input type="checkbox" />
      <div class="collapse-title text-sm font-medium py-2 min-h-0">
        Columnes visibles ({{ visibleCount() }} de {{ columns().length }})
      </div>
      <div class="collapse-content">
        <div class="flex flex-wrap gap-2 pt-2">
          @for (col of columns(); track col.key) {
            <label class="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                [checked]="visibleKeys().includes(col.key)"
                (change)="toggleColumn.emit(col.key)"
              />
              <span class="text-sm">{{ col.label }}</span>
            </label>
          }
        </div>
      </div>
    </div>
  `,
})
export class ColumnToggleComponent {
  columns = input.required<ColumnDef[]>();
  visibleKeys = input.required<string[]>();
  toggleColumn = output<string>();

  readonly visibleCount = computed(() =>
    this.columns().filter(c => this.visibleKeys().includes(c.key)).length
  );
}
