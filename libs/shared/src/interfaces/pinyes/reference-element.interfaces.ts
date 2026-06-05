import { ReferenceElementType } from '../../enums/reference-element-type.enum';

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
