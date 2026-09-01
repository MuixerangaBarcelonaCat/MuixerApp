import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CheckboxComponent } from '@muixer/ui';
import { ColumnDef } from '../../../models/column-def.model';

@Component({
  selector: 'app-column-toggle',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  imports: [FormsModule, CheckboxComponent],
  template: `
    <div class="collapse collapse-arrow bg-base-200/50 rounded-box border border-base-300">
      <!-- The bare structural checkbox below drives DaisyUI's own .collapse open/close state via
           CSS (:checked ~ .collapse-content) — not a real UI checkbox, so it stays raw rather than
           becoming a lib-checkbox (see docs/DESIGN_SYSTEM.md's lib-checkbox entry). -->
      <input type="checkbox" />
      <div class="collapse-title text-sm font-medium py-2 min-h-0">
        Columnes visibles ({{ visibleCount() }} de {{ columns().length }})
      </div>
      <div class="collapse-content">
        <div class="flex flex-wrap gap-2 pt-2">
          @for (col of columns(); track col.key) {
            <lib-checkbox
              size="sm"
              [ngModel]="visibleKeys().includes(col.key)"
              (ngModelChange)="toggleColumn.emit(col.key)"
            ><span class="text-sm">{{ col.label }}</span></lib-checkbox>
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
