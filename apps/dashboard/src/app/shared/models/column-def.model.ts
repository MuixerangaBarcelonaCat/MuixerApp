export type ColumnType = 'text' | 'badge' | 'pills' | 'date' | 'number' | 'actions' | 'custom';

export interface ColumnPill {
  text: string;
  class: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface ColumnDef<T = any> {
  key: string;
  label: string;
  defaultVisible: boolean;
  sortField?: string;
  type?: ColumnType;
  /** Optional transform: extract display value from item */
  value?: (item: T) => string | number | null | undefined;
  /** Optional badge class when type === 'badge' */
  badgeClass?: (item: T) => string;
  /** Colored text pills when type === 'pills' */
  pills?: (item: T) => ColumnPill[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GroupSeparator<T = any> {
  predicate: (item: T) => boolean;
  label: string;
}
