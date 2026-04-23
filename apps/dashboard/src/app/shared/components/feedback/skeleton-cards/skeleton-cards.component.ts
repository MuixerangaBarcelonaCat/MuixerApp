import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { NgClass } from '@angular/common';

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1 md:grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 md:grid-cols-3',
  4: 'grid-cols-1 md:grid-cols-4',
};

@Component({
  selector: 'app-skeleton-cards',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass],
  host: { class: 'block' },
  template: `
    <div class="grid gap-4" [ngClass]="gridClass()">
      @for (item of cardsArray(); track $index) {
        <div class="card bg-base-100 shadow-sm">
          <div class="card-body gap-3">
            <div class="skeleton h-5 w-2/3 rounded"></div>
            <div class="skeleton h-4 w-full rounded"></div>
            <div class="skeleton h-4 w-4/5 rounded"></div>
          </div>
        </div>
      }
    </div>
  `,
})
export class SkeletonCardsComponent {
  count = input(4);
  cols = input(2);

  readonly cardsArray = computed(() => Array.from({ length: this.count() }));
  readonly gridClass = computed(() => GRID_COLS[this.cols()] ?? GRID_COLS[2]);
}
