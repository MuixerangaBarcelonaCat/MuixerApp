export type ColumnType = 'text' | 'badge' | 'pills' | 'colorBadges' | 'date' | 'number' | 'actions' | 'custom';

export interface ColumnPill {
  text: string;
  class: string;
}

export interface ColumnColorBadge {
  text: string;
  color: string;
  /** Identifies the badge to `onColorBadgeClick` — required to make it clickable. */
  id?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ColumnDef<T = any> {
  key: string;
  label: string;
  defaultVisible: boolean;
  sortField?: string;
  type?: ColumnType;
  /**
   * Marks this column as the card title in the responsive card layout (`< lg`).
   * If no column is flagged, the first visible column is used as the title.
   */
  primary?: boolean;
  /** Optional transform: extract display value from item */
  value?: (item: T) => string | number | null | undefined;
  /** Optional badge class when type === 'badge' */
  badgeClass?: (item: T) => string;
  /** Colored text pills when type === 'pills' */
  pills?: (item: T) => ColumnPill[];
  /** Colored badges (background + contrasting text) when type === 'colorBadges' */
  colorBadges?: (item: T) => ColumnColorBadge[];
  /** Makes colorBadges clickable (e.g. click a tag to filter by it) — needs `badge.id` set. */
  onColorBadgeClick?: (id: string, item: T) => void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GroupSeparator<T = any> {
  predicate: (item: T) => boolean;
  label: string;
}
