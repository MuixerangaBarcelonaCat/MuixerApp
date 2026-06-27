import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { Attendance } from '../event/attendance.entity';
import { NodeAssignmentService, AssignmentDetail, InstanceNodeResponse } from '../node-assignment/node-assignment.service';
import { AttendanceStatus, FigureMode } from '@muixer/shared';

interface ProjectionInstanceData {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  figureMode: FigureMode;
  figureTemplate: { id: string; name: string; hasPinya: boolean } | null;
  nodes: InstanceNodeResponse[];
  assignments: AssignmentDetail[];
}

export interface ProjectionData {
  segment: {
    id: string;
    name: string | null;
    sortOrder: number;
    prevSegmentId: string | null;
    nextSegmentId: string | null;
  };
  instances: ProjectionInstanceData[];
  /** personId → AttendanceStatus for all attendances in this event */
  personAttendance: Record<string, AttendanceStatus>;
}

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

  async getProjection(eventId: string, segmentId: string): Promise<ProjectionData> {
    const segment = await this.segmentRepository.findOne({
      where: { id: segmentId, event: { id: eventId } },
    });
    if (!segment) {
      throw new NotFoundException(
        `Segment with ID ${segmentId} not found in event ${eventId}`,
      );
    }

    const allSegments = await this.segmentRepository.find({
      where: { event: { id: eventId } },
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

    const projectionInstances: ProjectionInstanceData[] = [];
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
        figureMode,
        figureTemplate: instance.figureTemplate
          ? {
              id: instance.figureTemplate.id,
              name: instance.figureTemplate.name,
              hasPinya,
            }
          : null,
        nodes,
        assignments,
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

    return {
      segment: {
        id: segment.id,
        name: segment.name,
        sortOrder: segment.sortOrder,
        prevSegmentId,
        nextSegmentId,
      },
      instances: projectionInstances,
      personAttendance,
    };
  }
}
