export interface DistributionNodeItem {
  id: string;
  label: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  renglaId: string | null;
  renglaPosition: number | null;
  positionType: string | null;
}

export interface DistributionAssignment {
  figureNodeId: string;
  personAlias: string;
}

export interface DistributionItem {
  instanceId: string;
  label: string | null;
  figureMode: string;
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
  assignments: DistributionAssignment[];
  figureTemplate: { id: string; name: string; nodes: DistributionNodeItem[] };
  troncGridCols: number;
  troncGridRows: number;
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
