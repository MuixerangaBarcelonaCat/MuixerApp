export type SortOrder = 'ASC' | 'DESC';

export interface SortChange {
  field: string;
  order: SortOrder | undefined;
}
