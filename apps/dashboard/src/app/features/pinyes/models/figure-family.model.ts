export interface FigureFamilyVariant {
  id: string;
  name: string;
  slug: string;
  variantOrder: number;
  nodeCount: number;
  renglaCount: number;
}

export interface FigureFamilyListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  variantCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FigureFamilyDetail extends FigureFamilyListItem {
  metadata: Record<string, unknown>;
  variants: FigureFamilyVariant[];
}

export interface FigureFamilyFilterParams {
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedFigureFamilies {
  data: FigureFamilyListItem[];
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
