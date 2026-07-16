import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  computed,
  signal,
  HostListener,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { ColumnDef, GroupSeparator } from '../../../models/column-def.model';
import { SortOrder, SortChange } from '../../../models/sort.model';
import { getContrastColor } from '../../../utils/color.util';

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
  imports: [NgClass, LucideAngularModule],
  host: { class: 'block' },
  templateUrl: './data-table.component.html',
})
export class DataTableComponent<T extends object> implements AfterViewInit, OnDestroy {
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

  readonly displayColumns = computed(() => {
    const visible = this.visibleColumns();
    const cols = this.columns();
    if (!visible.length) return cols;
    return cols.filter(c => visible.includes(c.key));
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

  readonly openActionsItem = signal<T | null>(null);
  readonly menuPosition = signal<{ top: number; left: number } | null>(null);

  toggleActionsMenu(event: Event, item: T): void {
    event.stopPropagation();
    if (this.openActionsItem() === item) {
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
    this.openActionsItem.set(item);
  }

  closeActionsMenu(): void {
    this.openActionsItem.set(null);
    this.menuPosition.set(null);
  }

  onRowAction(action: RowAction<T>): void {
    const item = this.openActionsItem();
    if (item) action.action(item);
    this.closeActionsMenu();
  }

  readonly visibleRowActions = computed<RowAction<T>[]>(() => {
    const item = this.openActionsItem();
    if (!item) return this.rowActions();
    return this.rowActions().filter((a) => !a.hidden?.(item));
  });

  resolveLabel(action: RowAction<T>, item: T): string {
    return typeof action.label === 'function' ? action.label(item) : action.label;
  }

  resolveIcon(action: RowAction<T>, item: T): string | undefined {
    return typeof action.icon === 'function' ? action.icon(item) : action.icon;
  }

  private scrollListener = () => this.closeActionsMenu();

  ngAfterViewInit(): void {
    document.addEventListener('scroll', this.scrollListener, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('scroll', this.scrollListener, true);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeActionsMenu();
  }
}
