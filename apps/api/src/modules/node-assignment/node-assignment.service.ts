import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';

export interface AssignmentDetail {
  id: string;
  figureInstanceId: string;
  compositionSlotId: string | null;
  node: {
    id: string;
    label: string;
    zone: string;
    z: number;
    positionType: string | null;
    sortOrder: number;
  };
  person: {
    id: string;
    alias: string;
    name: string;
    firstSurname: string;
    shoulderHeight: number | null;
  };
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  segmentName: string | null;
  instanceId: string;
  assignmentCount: number;
  totalNodes: number;
  assignments: {
    nodeId: string;
    nodeLabel: string;
    personId: string;
    personAlias: string;
  }[];
}

export interface BulkImportResult {
  created: AssignmentDetail[];
  conflicts: {
    nodeId: string;
    nodeLabel: string;
    personAlias: string;
    reason: string;
  }[];
}

function toAssignmentDetail(assignment: NodeAssignment): AssignmentDetail {
  return {
    id: assignment.id,
    figureInstanceId: assignment.figureInstance.id,
    compositionSlotId: assignment.compositionSlot?.id ?? null,
    node: {
      id: assignment.figureNode.id,
      label: assignment.figureNode.label,
      zone: assignment.figureNode.zone,
      z: assignment.figureNode.z,
      positionType: assignment.figureNode.positionType,
      sortOrder: assignment.figureNode.sortOrder,
    },
    person: {
      id: assignment.person.id,
      alias: (assignment.person as any).alias,
      name: (assignment.person as any).name,
      firstSurname: (assignment.person as any).firstSurname,
      shoulderHeight: (assignment.person as any).shoulderHeight ?? null,
    },
  };
}

@Injectable()
export class NodeAssignmentService {
  constructor(
    @InjectRepository(NodeAssignment)
    private readonly assignmentRepository: Repository<NodeAssignment>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
    @InjectRepository(FigureNode)
    private readonly figureNodeRepository: Repository<FigureNode>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(CompositionSlot)
    private readonly compositionSlotRepository: Repository<CompositionSlot>,
    @InjectRepository(FigureTemplate)
    private readonly figureTemplateRepository: Repository<FigureTemplate>,
    @InjectRepository(EventSegment)
    private readonly eventSegmentRepository: Repository<EventSegment>,
  ) {}

  async getByInstance(instanceId: string): Promise<AssignmentDetail[]> {
    const instance = await this.figureInstanceRepository.findOne({ where: { id: instanceId } });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId } },
      relations: ['figureNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    return assignments.map(toAssignmentDetail);
  }

  async assign(
    instanceId: string,
    dto: { nodeId: string; personId: string; compositionSlotId?: string },
  ): Promise<AssignmentDetail> {
    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'compositionTemplate', 'segment'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    const person = await this.personRepository.findOne({ where: { id: dto.personId } });
    if (!person) {
      throw new NotFoundException(`Person with ID ${dto.personId} not found`);
    }

    const figureNode = await this.figureNodeRepository.findOne({
      where: { id: dto.nodeId },
      relations: ['template'],
    });
    if (!figureNode) {
      throw new NotFoundException(`FigureNode with ID ${dto.nodeId} not found`);
    }

    const isComposition = instance.compositionTemplate !== null;

    if (isComposition) {
      if (!dto.compositionSlotId) {
        throw new BadRequestException('compositionSlotId is required for composition instances');
      }

      const slot = await this.compositionSlotRepository.findOne({
        where: { id: dto.compositionSlotId },
        relations: ['figureTemplate', 'composition'],
      });
      if (!slot) {
        throw new NotFoundException(`CompositionSlot with ID ${dto.compositionSlotId} not found`);
      }

      if (slot.figureTemplate.id !== figureNode.template.id) {
        throw new BadRequestException(
          `FigureNode ${dto.nodeId} does not belong to the template of slot ${dto.compositionSlotId}`,
        );
      }
    } else {
      if (dto.compositionSlotId) {
        throw new BadRequestException('compositionSlotId must not be provided for standalone figure instances');
      }

      if (!instance.figureTemplate || figureNode.template.id !== instance.figureTemplate.id) {
        throw new BadRequestException(
          `FigureNode ${dto.nodeId} does not belong to this instance's figure template`,
        );
      }
    }

    const compositionSlot = dto.compositionSlotId
      ? await this.compositionSlotRepository.findOne({ where: { id: dto.compositionSlotId } })
      : null;

    // Check node not already occupied (UNIQUE figureInstance+figureNode+compositionSlot)
    const nodeConflict = await this.assignmentRepository.findOne({
      where: {
        figureInstance: { id: instanceId },
        figureNode: { id: dto.nodeId },
        ...(compositionSlot ? { compositionSlot: { id: compositionSlot.id } } : { compositionSlot: null as any }),
      },
    });
    if (nodeConflict) {
      throw new ConflictException(
        `Node ${dto.nodeId} is already occupied in this figure instance`,
      );
    }

    // Check person not already in same instance
    const personConflict = await this.assignmentRepository.findOne({
      where: {
        figureInstance: { id: instanceId },
        person: { id: dto.personId },
        ...(compositionSlot ? { compositionSlot: { id: compositionSlot.id } } : { compositionSlot: null as any }),
      },
    });
    if (personConflict) {
      throw new ConflictException(
        `Person ${dto.personId} is already assigned in this figure instance`,
      );
    }

    // Check person not already in another instance of the same segment
    const segmentConflict = await this.assignmentRepository
      .createQueryBuilder('a')
      .innerJoin('a.figureInstance', 'fi')
      .where('fi.segmentId = :segmentId', { segmentId: instance.segment.id })
      .andWhere('a.personId = :personId', { personId: dto.personId })
      .getOne();

    if (segmentConflict) {
      throw new ConflictException(
        `Person ${dto.personId} is already assigned in another figure instance of this segment`,
      );
    }

    const assignment = this.assignmentRepository.create({
      figureInstance: instance,
      figureNode,
      person,
      compositionSlot,
    });

    const saved = await this.assignmentRepository.save(assignment);

    const populated = await this.assignmentRepository.findOne({
      where: { id: saved.id },
      relations: ['figureNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    return toAssignmentDetail(populated!);
  }

  async unassign(instanceId: string, assignmentId: string): Promise<void> {
    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['figureInstance'],
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    if (assignment.figureInstance.id !== instanceId) {
      throw new NotFoundException(`Assignment ${assignmentId} does not belong to instance ${instanceId}`);
    }

    await this.assignmentRepository.remove(assignment);
  }

  async getHistory(templateId: string): Promise<FigureHistoryEntry[]> {
    const template = await this.figureTemplateRepository.findOne({ where: { id: templateId } });
    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${templateId} not found`);
    }

    const instances = await this.figureInstanceRepository.find({
      where: { figureTemplate: { id: templateId } },
      relations: [
        'assignments',
        'assignments.figureNode',
        'assignments.person',
        'segment',
        'segment.event',
        'figureTemplate',
        'figureTemplate.nodes',
      ],
      order: { createdAt: 'DESC' },
    });

    return instances.map((instance) => {
      const event = instance.segment.event as any;
      return {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date,
        segmentName: (instance.segment as any).name ?? null,
        instanceId: instance.id,
        assignmentCount: instance.assignments?.length ?? 0,
        totalNodes: instance.figureTemplate?.nodes?.length ?? 0,
        assignments: (instance.assignments ?? []).map((a) => ({
          nodeId: a.figureNode.id,
          nodeLabel: a.figureNode.label,
          personId: a.person.id,
          personAlias: (a.person as any).alias,
        })),
      };
    });
  }

  async bulkImport(
    instanceId: string,
    dto: { sourceInstanceId: string; sourceCompositionSlotId?: string },
  ): Promise<BulkImportResult> {
    const targetInstance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'compositionTemplate', 'segment'],
    });
    if (!targetInstance) {
      throw new NotFoundException(`Target FigureInstance with ID ${instanceId} not found`);
    }

    const sourceInstance = await this.figureInstanceRepository.findOne({
      where: { id: dto.sourceInstanceId },
      relations: ['figureTemplate', 'segment'],
    });
    if (!sourceInstance) {
      throw new NotFoundException(`Source FigureInstance with ID ${dto.sourceInstanceId} not found`);
    }

    const sourceAssignments = await this.assignmentRepository.find({
      where: {
        figureInstance: { id: dto.sourceInstanceId },
        ...(dto.sourceCompositionSlotId
          ? { compositionSlot: { id: dto.sourceCompositionSlotId } }
          : {}),
      },
      relations: ['figureNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    const created: AssignmentDetail[] = [];
    const conflicts: BulkImportResult['conflicts'] = [];

    // Get target template node IDs for validation
    const targetTemplateId = targetInstance.figureTemplate?.id;
    const targetNodes = targetTemplateId
      ? await this.figureNodeRepository.find({ where: { template: { id: targetTemplateId } } })
      : [];
    const targetNodeIds = new Set(targetNodes.map((n) => n.id));

    for (const sourceAssignment of sourceAssignments) {
      const nodeId = sourceAssignment.figureNode.id;
      const personId = sourceAssignment.person.id;
      const personAlias = (sourceAssignment.person as any).alias;
      const nodeLabel = sourceAssignment.figureNode.label;

      // Skip nodes that no longer exist in current template
      if (targetTemplateId && !targetNodeIds.has(nodeId)) {
        conflicts.push({ nodeId, nodeLabel, personAlias, reason: 'Node no longer exists in current template' });
        continue;
      }

      // Check if node is already occupied in target
      const nodeOccupied = await this.assignmentRepository.findOne({
        where: { figureInstance: { id: instanceId }, figureNode: { id: nodeId } },
      });
      if (nodeOccupied) {
        conflicts.push({ nodeId, nodeLabel, personAlias, reason: 'Node already occupied in target instance' });
        continue;
      }

      // Check if person already in target instance
      const personInInstance = await this.assignmentRepository.findOne({
        where: { figureInstance: { id: instanceId }, person: { id: personId } },
      });
      if (personInInstance) {
        conflicts.push({ nodeId, nodeLabel, personAlias, reason: 'Person already assigned in target instance' });
        continue;
      }

      // Check if person already in segment
      const personInSegment = await this.assignmentRepository
        .createQueryBuilder('a')
        .innerJoin('a.figureInstance', 'fi')
        .where('fi.segmentId = :segmentId', { segmentId: targetInstance.segment.id })
        .andWhere('a.personId = :personId', { personId })
        .getOne();
      if (personInSegment) {
        conflicts.push({ nodeId, nodeLabel, personAlias, reason: 'Person already assigned in this segment' });
        continue;
      }

      try {
        const detail = await this.assign(instanceId, {
          nodeId,
          personId,
          compositionSlotId: undefined,
        });
        created.push(detail);
      } catch {
        conflicts.push({ nodeId, nodeLabel, personAlias, reason: 'Could not create assignment' });
      }
    }

    return { created, conflicts };
  }

  async countByNode(nodeId: string): Promise<number> {
    return this.assignmentRepository.count({ where: { figureNode: { id: nodeId } } });
  }
}
