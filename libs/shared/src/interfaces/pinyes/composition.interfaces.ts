import { FigureNodeItem } from './figure.interfaces';

export interface CompositionSlotFigureTemplate {
  id: string;
  name: string;
  slug: string;
  hasPinya: boolean;
  direction: number;
  nodeCount: number;
  nodes: FigureNodeItem[];
}

export interface CompositionSlotItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: CompositionSlotFigureTemplate;
}

export interface CompositionTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompositionTemplateDetail extends CompositionTemplateListItem {
  slots: CompositionSlotItem[];
}
