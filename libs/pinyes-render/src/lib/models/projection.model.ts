import {
  MemberProjectionPerson,
  StaffProjectionPerson,
} from '@muixer/shared';
import {
  AssignmentDetail,
  AttendanceStatus,
  InstanceNodeItem,
  SegmentConflict,
} from './assignment.model';
import { FigureMode } from './segment.model';

type ProjectionAssignmentBase = Omit<AssignmentDetail, 'person'>;

export type StaffProjectionAssignment = ProjectionAssignmentBase & {
  person: StaffProjectionPerson;
};

export type MemberProjectionAssignment = ProjectionAssignmentBase & {
  person: MemberProjectionPerson;
};

export type ProjectionAssignment =
  | StaffProjectionAssignment
  | MemberProjectionAssignment;

export function projectionShoulderHeight(
  person: StaffProjectionPerson | MemberProjectionPerson,
): number | null {
  return 'shoulderHeight' in person ? person.shoulderHeight : null;
}

export interface ProjectionInstance {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  projectionAngle: number | null;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
  figureMode: FigureMode;
  figureTemplate: { id: string; name: string; hasPinya: boolean } | null;
  nodes: InstanceNodeItem[];
  assignments: ProjectionAssignment[];
}

export interface StaffProjectionInstance extends Omit<ProjectionInstance, 'assignments'> {
  assignments: StaffProjectionAssignment[];
}

export interface MemberProjectionInstance extends Omit<ProjectionInstance, 'assignments'> {
  assignments: MemberProjectionAssignment[];
}

interface ProjectionSegmentBase {
  segment: {
    id: string;
    name: string | null;
    sortOrder: number;
    prevSegmentId: string | null;
    nextSegmentId: string | null;
  };
  personAttendance: Record<string, AttendanceStatus>;
  hasDistribution: boolean;
  /** Canonical conflicts for this segment (D13); empty in production until Phase 5. */
  conflicts: SegmentConflict[];
}

export interface StaffProjectionSegmentData extends ProjectionSegmentBase {
  instances: StaffProjectionInstance[];
}

export interface MemberProjectionSegmentData extends ProjectionSegmentBase {
  instances: MemberProjectionInstance[];
}

export type ProjectionSegmentData = StaffProjectionSegmentData;
export type ProjectionRenderableData =
  | StaffProjectionSegmentData
  | MemberProjectionSegmentData;
