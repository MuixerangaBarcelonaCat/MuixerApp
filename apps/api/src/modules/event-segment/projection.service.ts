import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { NodeAssignmentService, AssignmentDetail, InstanceNodeResponse } from '../node-assignment/node-assignment.service';

export interface ProjectionInstanceData {
  id: string;
  label: string | null;
  sortOrder: number;
  numberOfCordons: number | null;
  openCordons: string[] | null;
  projectionX: number | null;
  projectionY: number | null;
  projectionScale: number;
  figureTemplate: { id: string; name: string } | null;
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
}

@Injectable()
export class ProjectionService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(FigureInstance)
    private readonly instanceRepository: Repository<FigureInstance>,
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

    const projectionInstances: ProjectionInstanceData[] = await Promise.all(
      instances.map(async (instance) => {
        const [nodes, assignments] = await Promise.all([
          this.nodeAssignmentService.getInstanceNodes(instance.id),
          this.nodeAssignmentService.getByInstance(instance.id),
        ]);
        return {
          id: instance.id,
          label: instance.label,
          sortOrder: instance.sortOrder,
          numberOfCordons: instance.numberOfCordons,
          openCordons: instance.openCordons,
          projectionX: instance.projectionX,
          projectionY: instance.projectionY,
          projectionScale: instance.projectionScale,
          figureTemplate: instance.figureTemplate
            ? { id: instance.figureTemplate.id, name: instance.figureTemplate.name }
            : null,
          nodes,
          assignments,
        };
      }),
    );

    return {
      segment: {
        id: segment.id,
        name: segment.name,
        sortOrder: segment.sortOrder,
        prevSegmentId,
        nextSegmentId,
      },
      instances: projectionInstances,
    };
  }
}
