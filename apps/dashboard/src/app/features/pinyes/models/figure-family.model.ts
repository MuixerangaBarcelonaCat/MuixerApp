export type {
  FigureFamilyVariant,
  FigureFamilyListItem,
  FigureFamilyDetail,
} from '@muixer/shared';

export interface FigureFamilyFilterParams {
  search?: string;
  page?: number;
  limit?: number;
  /** When true the API returns FigureFamilyDetail[] (with variants) in a single request. */
  includeVariants?: boolean;
}

export interface PaginatedFigureFamilies {
  data: import('@muixer/shared').FigureFamilyListItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface PaginatedFigureFamiliesWithVariants {
  data: import('@muixer/shared').FigureFamilyDetail[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CreateFigureFamilyPayload {
  name: string;
  slug: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateFigureFamilyPayload {
  name?: string;
  slug?: string;
  description?: string;
  metadata?: Record<string, unknown>;
}
