import { ReferenceElementType } from '@muixer/shared';

export interface ReferenceElementItem {
  id: string;
  type: ReferenceElementType;
  label: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  sortOrder: number;
  hiddenInSegments: string[];
}

export interface CreateReferenceElementPayload {
  type: ReferenceElementType;
  label?: string | null;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  color?: string;
}

export interface UpdateReferenceElementPayload {
  type?: ReferenceElementType;
  label?: string | null;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  color?: string | null;
}

export interface BatchElementUpdate {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
