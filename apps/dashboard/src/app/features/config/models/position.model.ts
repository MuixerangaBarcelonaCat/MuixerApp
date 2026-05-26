import { FigureZone } from '@muixer/shared';

export interface PositionWithCount {
  id: string;
  name: string;
  slug: string;
  shortDescription: string | null;
  longDescription: string | null;
  color: string | null;
  zone: FigureZone | null;
  personCount: number;
}

export interface CreatePositionDto {
  name: string;
  slug: string;
  shortDescription?: string;
  longDescription?: string;
  color?: string;
  zone?: FigureZone;
}

export interface UpdatePositionDto {
  name?: string;
  shortDescription?: string;
  longDescription?: string;
  color?: string;
  zone?: FigureZone;
}
