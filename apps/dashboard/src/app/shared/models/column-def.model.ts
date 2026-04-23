export type ColumnType = 'text' | 'badge' | 'date' | 'number' | 'actions' | 'custom';

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
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface GroupSeparator<T = any> {
  predicate: (item: T) => boolean;
  label: string;
}
