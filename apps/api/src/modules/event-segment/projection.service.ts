import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  AssignmentDetail,
  FigureZone,
  InstanceNodeItem,
  NodeShape,
  ProjectionInstance,
  ProjectionSegmentData,
} from '@muixer/shared';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { InstanceNode } from './entities/instance-node.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { Person } from '../person/person.entity';
import { isNodeVisible } from '../node-assignment/node-assignment.service';

@Injectable()
export class ProjectionService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(FigureInstance)
    private readonly instanceRepository: Repository<FigureInstance>,
    @InjectRepository(InstanceNode)
    private readonly instanceNodeRepository: Repository<InstanceNode>,
    @InjectRepository(NodeAssignment)
    private readonly assignmentRepository: Repository<NodeAssignment>,
  ) {}

  async getProjection(eventId: string, segmentId: string): Promise<ProjectionSegmentData> {
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

    const instanceIds = instances.map((i) => i.id);

    const [allNodes, allAssignments] = await Promise.all([
      instanceIds.length > 0
        ? this.instanceNodeRepository.find({
            where: { figureInstance: { id: In(instanceIds) } },
            relations: ['figureInstance'],
            order: { sortOrder: 'ASC' },
          })
        : Promise.resolve([]),
      instanceIds.length > 0
        ? this.assignmentRepository.find({
            where: { figureInstance: { id: In(instanceIds) } },
            relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
          })
        : Promise.resolve([]),
    ]);

    const nodesByInstance = new Map<string, InstanceNode[]>();
    for (const node of allNodes) {
      const iid = node.figureInstance.id;
      if (!nodesByInstance.has(iid)) nodesByInstance.set(iid, []);
      nodesByInstance.get(iid)!.push(node);
    }

    const assignmentsByInstance = new Map<string, NodeAssignment[]>();
    for (const a of allAssignments) {
      const iid = a.figureInstance.id;
      if (!assignmentsByInstance.has(iid)) assignmentsByInstance.set(iid, []);
      assignmentsByInstance.get(iid)!.push(a);
    }

    const projectionInstances: ProjectionInstance[] = instances.map((instance) => {
      let nodes: InstanceNodeItem[] = (nodesByInstance.get(instance.id) ?? []).map((n) => ({
        id: n.id,
        sourceNodeId: n.sourceNodeId,
        originNodeId: n.originNodeId,
        label: n.label,
        zone: n.zone as FigureZone,
        positionType: n.positionType,
        x: n.x,
        y: n.y,
        z: n.z,
        width: n.width,
        height: n.height,
        rotation: n.rotation,
        color: n.color,
        shape: n.shape as NodeShape,
        sortOrder: n.sortOrder,
        ringLevel: n.ringLevel,
        renglaId: n.renglaId,
        renglaPosition: n.renglaPosition,
        isSnapshotted: true,
      }));

      if (instance.numberOfCordons !== null || (instance.openCordons && instance.openCordons.length > 0)) {
        nodes = nodes.filter((node) =>
          isNodeVisible(node, instance.numberOfCordons, instance.openCordons),
        );
      }

      const assignments: AssignmentDetail[] = (assignmentsByInstance.get(instance.id) ?? []).map((a) => ({
        id: a.id,
        figureInstanceId: a.figureInstance.id,
        compositionSlotId: a.compositionSlot?.id ?? null,
        node: {
          id: a.instanceNode.id,
          label: a.instanceNode.label,
          zone: a.instanceNode.zone as FigureZone,
          z: a.instanceNode.z,
          positionType: a.instanceNode.positionType,
          sortOrder: a.instanceNode.sortOrder,
          ringLevel: a.instanceNode.ringLevel,
          originNodeId: a.instanceNode.originNodeId,
          sourceNodeId: a.instanceNode.sourceNodeId,
        },
        person: {
          id: a.person.id,
          alias: (a.person as Person).alias,
          name: (a.person as Person).name,
          firstSurname: (a.person as Person).firstSurname,
          shoulderHeight: (a.person as Person).shoulderHeight ?? null,
        },
      }));

      return {
        id: instance.id,
        label: instance.label,
        sortOrder: instance.sortOrder,
        numberOfCordons: instance.numberOfCordons,
        openCordons: instance.openCordons,
        figureTemplate: instance.figureTemplate
          ? { id: instance.figureTemplate.id, name: instance.figureTemplate.name }
          : null,
        nodes,
        assignments,
      };
    });

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
