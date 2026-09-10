import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { Attendance } from '../event/attendance.entity';
import { NodeAssignmentService, AssignmentDetail, InstanceNodeResponse } from '../node-assignment/node-assignment.service';
import {
  AttendanceStatus,
  FigureMode,
  MemberProjectionPerson,
  SegmentConflict,
  StaffProjectionPerson,
} from '@muixer/shared';

export type ProjectionAudience = 'staff' | 'member';

export interface ProjectionOptions {
  audience: ProjectionAudience;
  onlyPublished?: boolean;
}

type ProjectionAssignmentBase = Omit<AssignmentDetail, 'person'>;

export type StaffProjectionAssignment = ProjectionAssignmentBase & {
  person: StaffProjectionPerson;
};

export type MemberProjectionAssignment = ProjectionAssignmentBase & {
  person: MemberProjectionPerson;
};

interface ProjectionInstanceData<TAssignment> {
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
  nodes: InstanceNodeResponse[];
  assignments: TAssignment[];
}

interface ProjectionDataBase<TAssignment> {
  segment: {
    id: string;
    name: string | null;
    sortOrder: number;
    prevSegmentId: string | null;
    nextSegmentId: string | null;
  };
  instances: ProjectionInstanceData<TAssignment>[];
  /** true if at least one instance has a custom distribution position set */
  hasDistribution: boolean;
  /** personId → AttendanceStatus for all attendances in this event */
  personAttendance: Record<string, AttendanceStatus>;
  /** Canonical conflicts (D13) for the projected segment — last line of defense during assaig. */
  conflicts: SegmentConflict[];
}

export type StaffProjectionData = ProjectionDataBase<StaffProjectionAssignment>;
export type MemberProjectionData = ProjectionDataBase<MemberProjectionAssignment>;
type ProjectionData = StaffProjectionData | MemberProjectionData;

@Injectable()
export class ProjectionService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(FigureInstance)
    private readonly instanceRepository: Repository<FigureInstance>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    private readonly nodeAssignmentService: NodeAssignmentService,
  ) {}

  async getProjection(
    eventId: string,
    segmentId: string,
    options: ProjectionOptions & { audience: 'staff' },
  ): Promise<StaffProjectionData>;
  async getProjection(
    eventId: string,
    segmentId: string,
    options: ProjectionOptions & { audience: 'member' },
  ): Promise<MemberProjectionData>;
  async getProjection(
    eventId: string,
    segmentId: string,
    options: ProjectionOptions,
  ): Promise<ProjectionData> {
    const { audience, onlyPublished = false } = options;

    const segment = await this.segmentRepository.findOne({
      where: onlyPublished
        ? { id: segmentId, event: { id: eventId }, isPublished: true }
        : { id: segmentId, event: { id: eventId } },
    });
    if (!segment) {
      throw new NotFoundException(
        `Segment with ID ${segmentId} not found in event ${eventId}`,
      );
    }

    const allSegments = await this.segmentRepository.find({
      where: onlyPublished ? { event: { id: eventId }, isPublished: true } : { event: { id: eventId } },
      order: { sortOrder: 'ASC' },
      select: ['id', 'sortOrder'],
    });

    const currentIndex = allSegments.findIndex((s) => s.id === segmentId);
    const prevSegmentId = currentIndex > 0 ? allSegments[currentIndex - 1].id : null;
    const nextSegmentId = currentIndex < allSegments.length - 1 ? allSegments[currentIndex + 1].id : null;

    const instances = await this.instanceRepository.find({
      where: { segment: { id: segmentId } },
      relations: ['figureTemplate'],
      order: { sortOrder: 'ASC' },
    });

    const projectionInstances: ProjectionInstanceData<
      StaffProjectionAssignment | MemberProjectionAssignment
    >[] = [];
    for (const instance of instances) {
      let nodes: InstanceNodeResponse[] = [];
      let assignments: AssignmentDetail[] = [];

      if (instance.figureTemplate) {
        [nodes, assignments] = await Promise.all([
          this.nodeAssignmentService.getInstanceNodes(instance.id),
          this.nodeAssignmentService.getByInstance(instance.id),
        ]);
      }

      const figureMode = instance.figureMode ?? FigureMode.COMPLETA;
      const hasPinyaNodes = nodes.some((n) => n.zone === 'PINYA');
      // REMAT and NETA behave like a figura neta: no pinya in projection
      const hasPinya = hasPinyaNodes && figureMode !== FigureMode.REMAT && figureMode !== FigureMode.NETA;

      projectionInstances.push({
        id: instance.id,
        label: instance.label,
        sortOrder: instance.sortOrder,
        numberOfCordons: instance.numberOfCordons ?? null,
        projectionX: instance.projectionX,
        projectionY: instance.projectionY,
        projectionScale: instance.projectionScale,
        projectionAngle: instance.projectionAngle ?? null,
        troncPanelX: instance.troncPanelX ?? null,
        troncPanelY: instance.troncPanelY ?? null,
        troncPanelWidth: instance.troncPanelWidth ?? null,
        troncPanelHeight: instance.troncPanelHeight ?? null,
        figureMode,
        figureTemplate: instance.figureTemplate
          ? {
              id: instance.figureTemplate.id,
              name: instance.figureTemplate.name,
              hasPinya,
            }
          : null,
        nodes,
        assignments: assignments.map((assignment) =>
          audience === 'staff'
            ? this.toStaffProjectionAssignment(assignment)
            : this.toMemberProjectionAssignment(assignment),
        ),
      });
    }

    const attendances = await this.attendanceRepository.find({
      where: { event: { id: eventId } },
      relations: ['person'],
      select: { id: true, status: true, person: { id: true } },
    });
    const personAttendance: Record<string, AttendanceStatus> = {};
    for (const a of attendances) {
      personAttendance[a.person.id] = a.status;
    }

    const hasDistribution = projectionInstances.some((i) => i.projectionX !== null);

    const { data: conflicts } = await this.nodeAssignmentService.getSegmentConflicts(segmentId);

    return {
      segment: {
        id: segment.id,
        name: segment.name,
        sortOrder: segment.sortOrder,
        prevSegmentId,
        nextSegmentId,
      },
      instances: projectionInstances,
      hasDistribution,
      personAttendance,
      conflicts,
    };
  }

  private toStaffProjectionAssignment(
    assignment: AssignmentDetail,
  ): StaffProjectionAssignment {
    return {
      ...assignment,
      person: {
        id: assignment.person.id,
        alias: assignment.person.alias,
        name: assignment.person.name,
        shoulderHeight: assignment.person.shoulderHeight,
        notes: assignment.person.notes,
        notesEmoji: assignment.person.notesEmoji,
      },
    };
  }

  private toMemberProjectionAssignment(
    assignment: AssignmentDetail,
  ): MemberProjectionAssignment {
    return {
      ...assignment,
      person: {
        id: assignment.person.id,
        alias: assignment.person.alias,
        name: assignment.person.name,
      },
    };
  }
}
