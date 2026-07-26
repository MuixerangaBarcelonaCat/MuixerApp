export interface TagWithCount {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  longDescription: string | null;
  color: string | null;
  positionTypes: string[];
  personCount: number;
}

export interface CreateTagDto {
  name: string;
  slug: string;
  shortDescription?: string;
  longDescription?: string;
  color?: string;
  positionTypes?: string[];
}

export interface UpdateTagDto {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  color?: string;
  positionTypes?: string[];
}
