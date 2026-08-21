import { Component, ChangeDetectionStrategy, input, output, computed } from '@angular/core';
import { ButtonComponent, ButtonGroupComponent } from '@muixer/ui';

@Component({
  selector: 'app-pagination',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent],
  host: { class: 'block' },
  template: `
    <div class="flex flex-wrap items-center justify-between gap-3">
      <!-- Info -->
      <span class="text-sm text-base-content/60">
        Mostrant {{ rangeStart() }}–{{ rangeEnd() }} de {{ totalItems() }}
      </span>

      <div class="flex items-center gap-3 flex-wrap">
        <!-- Limit selector -->
        <div class="flex items-center gap-1.5">
          <span class="text-sm text-base-content/60">Per pàgina:</span>
          <select
            class="select select-bordered select-sm w-20"
            [value]="limit()"
            (change)="onLimitChange($event)"
          >
            @for (opt of limitOptions; track opt) {
              <option [value]="opt">{{ opt }}</option>
            }
          </select>
        </div>

        <!-- Page buttons -->
        @if (totalPages() > 1) {
          <lib-button-group>
            <lib-button
              joinItem
              outlineMode
              variant="neutral"
              size="sm"
              [disabled]="page() <= 1"
              (clicked)="pageChange.emit(page() - 1)"
              ariaLabel="Pàgina anterior"
            >«</lib-button>

            @for (p of pageNumbers(); track p) {
              @if (p === -1) {
                <lib-button joinItem outlineMode variant="neutral" size="sm" disabled>…</lib-button>
              } @else {
                <lib-button joinItem outlineMode variant="neutral" size="sm" [active]="p === page()" (clicked)="pageChange.emit(p)">
                  {{ p }}
                </lib-button>
              }
            }

            <lib-button
              joinItem
              outlineMode
              variant="neutral"
              size="sm"
              [disabled]="page() >= totalPages()"
              (clicked)="pageChange.emit(page() + 1)"
              ariaLabel="Pàgina següent"
            >»</lib-button>
          </lib-button-group>
        }
      </div>
    </div>
  `,
})
export class PaginationComponent {
  page = input.required<number>();
  totalPages = input.required<number>();
  limit = input.required<number>();
  totalItems = input.required<number>();

  pageChange = output<number>();
  limitChange = output<number>();

  readonly limitOptions = [25, 50, 100];

  readonly rangeStart = computed(() => {
    if (this.totalItems() === 0) return 0;
    return (this.page() - 1) * this.limit() + 1;
  });

  readonly rangeEnd = computed(() =>
    Math.min(this.page() * this.limit(), this.totalItems())
  );

  readonly pageNumbers = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

    const pages: number[] = [1];
    if (current > 3) pages.push(-1);
    for (let i = Math.max(2, current - 1); i <= Math.min(total - 1, current + 1); i++) {
      pages.push(i);
    }
    if (current < total - 2) pages.push(-1);
    pages.push(total);
    return pages;
  });

  onLimitChange(event: Event): void {
    const value = parseInt((event.target as HTMLSelectElement).value, 10);
    this.limitChange.emit(value);
  }
}
