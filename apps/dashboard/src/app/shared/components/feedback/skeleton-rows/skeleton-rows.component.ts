import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

@Component({
  selector: 'app-skeleton-rows',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    @for (row of rowsArray(); track $index) {
      <tr>
        @for (col of colsArray(); track $index; let first = $first) {
          <td>
            <div class="skeleton h-4 rounded" [class]="first ? 'w-28' : 'w-20'"></div>
          </td>
        }
      </tr>
    }
  `,
})
export class SkeletonRowsComponent {
  rows = input(8);
  columns = input(5);

  readonly rowsArray = computed(() => Array.from({ length: this.rows() }));
  readonly colsArray = computed(() => Array.from({ length: this.columns() }));
}
