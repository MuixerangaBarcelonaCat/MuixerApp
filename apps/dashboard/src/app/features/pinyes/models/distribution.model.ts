import { FigureNodeItem } from './figure-template.model';

export interface DistributionItem {
  instanceId: string;
  label: string | null;
  figureTemplate: { id: string; name: string; nodes: FigureNodeItem[] };
  projectionX: number | null;
  projectionY: number | null;
  projectionAngle: number | null;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}

export interface SegmentDistributionData {
  segment: { id: string; name: string | null };
  items: DistributionItem[];
}

export interface InstanceDistributionPayload {
  instanceId: string;
  x: number;
  y: number;
  angle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}
