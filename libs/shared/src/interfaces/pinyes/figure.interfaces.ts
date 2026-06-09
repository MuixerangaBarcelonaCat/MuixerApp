import { FigureZone } from '../../enums/figure-zone.enum';
import { NodeShape } from '../../enums/node-shape.enum';

export interface FigureNodeItem {
  id: string;
  label: string;
  zone: FigureZone;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: NodeShape;
  sortOrder: number;
  climbPath: string | null;
  ringLevel: number | null;
  originNodeId: string | null;
  renglaId: string | null;
  renglaPosition: number | null;
  metadata: Record<string, unknown>;
}

export interface RenglaItem {
  id: string;
  name: string;
  sortOrder: number;
  startPosition: number;
  allowsCordoObert: boolean;
}

export interface FigureTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  hasPinya: boolean;
  direction: number;
  variantOrder: number;
  familyId: string | null;
  familyName: string | null;
  nodeCount: number;
  renglaCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FigureTemplateDetail extends FigureTemplateListItem {
  metadata: Record<string, unknown>;
  nodes: FigureNodeItem[];
  rengles: RenglaItem[];
}

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
