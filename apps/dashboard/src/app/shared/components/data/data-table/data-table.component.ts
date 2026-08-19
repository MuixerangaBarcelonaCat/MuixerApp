import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  inject,
  DestroyRef,
  HostListener,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { CardComponent } from '@muixer/ui';
import { ColumnDef, GroupSeparator } from '../../../models/column-def.model';
import { SortOrder, SortChange } from '../../../models/sort.model';
import { getContrastColor } from '@muixer/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface RowAction<T = any> {
  label: string | ((item: T) => string);
  icon?: string | ((item: T) => string | undefined);
  class?: string;
  hidden?: (item: T) => boolean;
  action: (item: T) => void;
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, LucideAngularModule, CardComponent],
  host: { class: 'block' },
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T extends object> {
  items = input.required<T[]>();
  columns = input.required<ColumnDef<T>[]>();
  visibleColumns = input<string[]>([]);
  sortBy = input<string | undefined>(undefined);
  sortOrder = input<SortOrder | undefined>(undefined);
  loading = input(false);
  skeletonRows = input(8);
  groupSeparator = input<GroupSeparator<T> | undefined>(undefined);
  rowActions = input<RowAction<T>[]>([]);

  rowClick = output<T>();
  sortChange = output<SortChange>();

  /**
   * True below the `lg` breakpoint (< 1024px): the table reflows into stacked cards
   * instead of overflowing horizontally. Driven by `matchMedia`; falls back to `false`
   * (table mode) in non-browser/test environments where `matchMedia` is unavailable.
   */
  readonly cardMode = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 1023.98px)');
      this.cardMode.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.cardMode.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }
  }

  readonly displayColumns = computed(() => {
    const visible = this.visibleColumns();
    const cols = this.columns();
    if (!visible.length) return cols;
    return cols.filter(c => visible.includes(c.key));
  });

  /** Card-mode title column: the one flagged `primary`, else the first visible column. */
  readonly primaryColumn = computed<ColumnDef<T> | null>(() => {
    const cols = this.displayColumns();
    return cols.find((c) => c.primary) ?? cols[0] ?? null;
  });

  /** Card-mode body columns: every visible column except the title. */
  readonly secondaryColumns = computed<ColumnDef<T>[]>(() => {
    const primary = this.primaryColumn();
    return this.displayColumns().filter((c) => c !== primary);
  });

  readonly skeletonArray = computed(() =>
    Array.from({ length: this.skeletonRows() })
  );

  getSortIcon(col: ColumnDef<T>): string {
    if (!col.sortField || this.sortBy() !== col.sortField) return 'ChevronsUpDown';
    return this.sortOrder() === 'ASC' ? 'ChevronUp' : 'ChevronDown';
  }

  isSorted(col: ColumnDef<T>): boolean {
    return !!col.sortField && this.sortBy() === col.sortField;
  }

  onSort(col: ColumnDef<T>): void {
    if (!col.sortField) return;
    const field = col.sortField;
    if (this.sortBy() !== field) {
      this.sortChange.emit({ field, order: 'ASC' });
    } else if (this.sortOrder() === 'ASC') {
      this.sortChange.emit({ field, order: 'DESC' });
    } else {
      this.sortChange.emit({ field, order: undefined });
    }
  }

  readonly getContrastColor = getContrastColor;

  getCellValue(item: T, col: ColumnDef<T>): string | number | null | undefined {
    if (col.value) return col.value(item);
    return (item as Record<string, unknown>)[col.key] as string | number | null | undefined;
  }

  isSecondaryGroup(item: T): boolean {
    return !!this.groupSeparator()?.predicate(item);
  }

  /**
   * Returns true if this item is the FIRST item in the past group,
   * meaning we should render the separator row BEFORE it.
   */
  showSeparatorBefore(item: T, index: number): boolean {
    const sep = this.groupSeparator();
    if (!sep) return false;
    const items = this.items();
    const isPast = sep.predicate(item);
    if (!isPast) return false;
    // Show separator before the first past item
    const prevItem = items[index - 1];
    return index === 0 || !sep.predicate(prevItem);
  }

  readonly openActionsIndex = signal<number | null>(null);
  readonly menuPosition = signal<{ top: number; left: number } | null>(null);

  toggleActionsMenu(event: Event, index: number): void {
    event.stopPropagation();
    if (this.openActionsIndex() === index) {
      this.closeActionsMenu();
      return;
    }

    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    const menuWidth = 160;

    this.menuPosition.set({
      top: rect.bottom + 4,
      left: Math.max(8, rect.right - menuWidth),
    });
    this.openActionsIndex.set(index);
  }

  closeActionsMenu(): void {
    this.openActionsIndex.set(null);
    this.menuPosition.set(null);
  }

  onRowAction(action: RowAction<T>, item: T): void {
    action.action(item);
    this.closeActionsMenu();
  }

  readonly openItem = computed<T | null>(() => {
    const idx = this.openActionsIndex();
    return idx !== null ? (this.items()[idx] ?? null) : null;
  });

  readonly visibleRowActions = computed<RowAction<T>[]>(() => {
    const item = this.openItem();
    if (!item) return this.rowActions();
    return this.rowActions().filter((a) => !a.hidden?.(item));
  });

  resolveLabel(action: RowAction<T>, item: T): string {
    return typeof action.label === 'function' ? action.label(item) : action.label;
  }

  resolveIcon(action: RowAction<T>, item: T): string | undefined {
    return typeof action.icon === 'function' ? action.icon(item) : action.icon;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeActionsMenu();
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.closeActionsMenu();
  }
}
