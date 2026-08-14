import { AssignmentDetail, AttendanceStatus, InstanceNodeItem, SegmentConflict } from './assignment.model';
import { FigureMode } from './segment.model';

export interface ProjectionInstance {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  projectionAngle: number;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
  figureMode: FigureMode;
  figureTemplate: { id: string; name: string; hasPinya: boolean } | null;
  nodes: InstanceNodeItem[];
  assignments: AssignmentDetail[];
}

export interface ProjectionSegmentData {
  segment: {
    id: string;
    name: string | null;
    sortOrder: number;
    prevSegmentId: string | null;
    nextSegmentId: string | null;
  };
  instances: ProjectionInstance[];
  personAttendance: Record<string, AttendanceStatus>;
  hasDistribution: boolean;
  /** Canonical conflicts for this segment (D13); empty in production until Phase 5. */
  conflicts: SegmentConflict[];
}
