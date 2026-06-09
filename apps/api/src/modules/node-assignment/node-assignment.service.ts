import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventType, FigureZone } from '@muixer/shared';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Event } from '../event/event.entity';

// ─── Response interfaces ────────────────────────────────────────────────────

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
    ringLevel: number | null;
    originNodeId: string | null;
    sourceNodeId: string | null;
  };
  person: {
    id: string;
    alias: string;
    name: string;
    firstSurname: string;
    shoulderHeight: number | null;
  };
}

export interface InstanceNodeResponse {
  id: string;
  sourceNodeId: string | null;
  originNodeId: string | null;
  label: string;
  zone: string;
  positionType: string | null;
  x: number;
  y: number;
  z: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  sortOrder: number;
  ringLevel: number | null;
  renglaId: string | null;
  renglaPosition: number | null;
  isSnapshotted: boolean;
}

export interface FigureHistoryEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentName: string | null;
  instanceId: string;
  snapshotted: boolean;
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

export interface PersonAssignmentEntry {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventType: EventType;
  segmentName: string;
  instanceId: string;
  figureName: string;
  figureSlug: string;
  nodeLabel: string;
  positionType: string | null;
  zone: FigureZone;
  z: number;
}

export interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: { total: number; page: number; limit: number };
}

export interface EventFigureSummary {
  instanceId: string;
  figureName: string;
  snapshotted: boolean;
  totalNodes: number;
  assignedNodes: number;
  assignments: {
    nodeLabel: string;
    positionType: string | null;
    zone: FigureZone;
    z: number;
    personAlias: string;
    personId: string;
  }[];
}

export interface EventSegmentSummary {
  segmentId: string;
  segmentName: string;
  sortOrder: number;
  figures: EventFigureSummary[];
}

export interface EventAssignmentSummary {
  segments: EventSegmentSummary[];
}

export interface HistoryQueryParams {
  page?: number;
  limit?: number;
  seasonId?: string;
}

// ─── Mappers ────────────────────────────────────────────────────────────────

function toAssignmentDetail(assignment: NodeAssignment): AssignmentDetail {
  const node = assignment.instanceNode;
  return {
    id: assignment.id,
    figureInstanceId: assignment.figureInstance.id,
    compositionSlotId: assignment.compositionSlot?.id ?? null,
    node: {
      id: node.id,
      label: node.label,
      zone: node.zone,
      z: node.z,
      positionType: node.positionType,
      sortOrder: node.sortOrder,
      ringLevel: node.ringLevel,
      originNodeId: node.originNodeId,
      sourceNodeId: node.sourceNodeId,
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

function instanceNodeToResponse(node: InstanceNode): InstanceNodeResponse {
  return {
    id: node.id,
    sourceNodeId: node.sourceNodeId,
    originNodeId: node.originNodeId,
    label: node.label,
    zone: node.zone,
    positionType: node.positionType,
    x: node.x,
    y: node.y,
    z: node.z,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    color: node.color,
    shape: node.shape,
    sortOrder: node.sortOrder,
    ringLevel: node.ringLevel,
    renglaId: node.renglaId,
    renglaPosition: node.renglaPosition,
    isSnapshotted: true,
  };
}

function figureNodeToResponse(node: FigureNode): InstanceNodeResponse {
  return {
    id: node.id,
    sourceNodeId: null,
    originNodeId: node.originNodeId,
    label: node.label,
    zone: node.zone,
    positionType: node.positionType,
    x: node.x,
    y: node.y,
    z: node.z,
    width: node.width,
    height: node.height,
    rotation: node.rotation,
    color: node.color,
    shape: node.shape,
    sortOrder: node.sortOrder,
    ringLevel: node.ringLevel,
    renglaId: node.renglaId,
    renglaPosition: node.renglaPosition,
    isSnapshotted: false,
  };
}


export function isNodeVisible(
  node: { renglaId: string | null; renglaPosition: number | null; positionType: string | null },
  numberOfCordons: number | null,
  openCordons: string[] | null,
): boolean {
  if (!node.renglaId || node.renglaPosition === null) return true;
  if (node.positionType === 'cordo-obert') {
    return openCordons?.includes(node.renglaId) ?? false;
  }
  return node.renglaPosition <= (numberOfCordons ?? Infinity);
}

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class NodeAssignmentService {
  constructor(
    @InjectRepository(NodeAssignment)
    private readonly assignmentRepository: Repository<NodeAssignment>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
    @InjectRepository(InstanceNode)
    private readonly instanceNodeRepository: Repository<InstanceNode>,
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
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  // ── B.4 — Instance nodes (live template or snapshot) ──────────────────────

  async getInstanceNodes(instanceId: string): Promise<InstanceNodeResponse[]> {
    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    let allNodes: InstanceNodeResponse[];

    if (instance.snapshotted) {
      const nodes = await this.instanceNodeRepository.find({
        where: { figureInstance: { id: instanceId } },
        order: { sortOrder: 'ASC' },
      });
      allNodes = nodes.map(instanceNodeToResponse);
    } else {
      if (!instance.figureTemplate) {
        throw new BadRequestException('Instance has no figure template and has not been snapshotted');
      }

      const template = await this.figureTemplateRepository.findOne({
        where: { id: instance.figureTemplate.id },
        relations: ['nodes'],
      });

      allNodes = (template?.nodes ?? [])
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map(figureNodeToResponse);
    }

    if (instance.numberOfCordons !== null || (instance.openCordons && instance.openCordons.length > 0)) {
      return allNodes.filter((node) =>
        isNodeVisible(node, instance.numberOfCordons, instance.openCordons),
      );
    }

    return allNodes;
  }

  // ── Existing — assignments list ────────────────────────────────────────────

  async getByInstance(instanceId: string): Promise<AssignmentDetail[]> {
    const instance = await this.figureInstanceRepository.findOne({ where: { id: instanceId } });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId } },
      relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    return assignments.map(toAssignmentDetail);
  }

  // ── B.2 — assign with auto-snapshot ───────────────────────────────────────

  async assign(
    instanceId: string,
    dto: { nodeId: string; personId: string; compositionSlotId?: string },
  ): Promise<AssignmentDetail> {
    await this.checkEventLock(instanceId);

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'compositionTemplate', 'segment'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    let instanceNode: InstanceNode;

    if (!instance.snapshotted) {
      // B.1 — auto-snapshot on first assignment
      const snapshotNodes = await this.snapshotInstance(instance);
      // dto.nodeId is a FigureNode.id; find the InstanceNode it was copied from
      const matched = snapshotNodes.find((n) => n.sourceNodeId === dto.nodeId);
      if (!matched) {
        throw new NotFoundException(
          `No InstanceNode found for template node ID ${dto.nodeId} after snapshot`,
        );
      }
      instanceNode = matched;
    } else {
      // Already snapshotted. Accept either InstanceNode.id (Phase D+) or FigureNode.id via sourceNodeId
      // (Phase A/C canvas, which still reads template nodes).
      const byId = await this.instanceNodeRepository.findOne({
        where: { id: dto.nodeId, figureInstance: { id: instanceId } },
      });
      const found =
        byId ??
        (await this.instanceNodeRepository.findOne({
          where: { sourceNodeId: dto.nodeId, figureInstance: { id: instanceId } },
        }));
      if (!found) {
        throw new NotFoundException(
          `InstanceNode not found for node ID ${dto.nodeId} in this instance`,
        );
      }
      instanceNode = found;
    }

    const person = await this.personRepository.findOne({ where: { id: dto.personId } });
    if (!person) {
      throw new NotFoundException(`Person with ID ${dto.personId} not found`);
    }

    const compositionSlot = dto.compositionSlotId
      ? await this.compositionSlotRepository.findOne({ where: { id: dto.compositionSlotId } })
      : null;

    const nodeConflict = await this.assignmentRepository.findOne({
      where: {
        figureInstance: { id: instanceId },
        instanceNode: { id: instanceNode.id },
        ...(compositionSlot ? { compositionSlot: { id: compositionSlot.id } } : { compositionSlot: null as any }),
      },
    });
    if (nodeConflict) {
      throw new ConflictException(
        `Node ${instanceNode.id} is already occupied in this figure instance`,
      );
    }

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
      instanceNode,
      person,
      compositionSlot,
    });

    const saved = await this.assignmentRepository.save(assignment);

    const populated = await this.assignmentRepository.findOne({
      where: { id: saved.id },
      relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    return toAssignmentDetail(populated!);
  }

  // ── B.7 — Swap two assignments ────────────────────────────────────────────

  async swap(
    instanceId: string,
    dto: { assignmentIdA: string; assignmentIdB: string },
  ): Promise<{ a: AssignmentDetail; b: AssignmentDetail }> {
    await this.checkEventLock(instanceId);

    const [assignmentA, assignmentB] = await Promise.all([
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdA },
        relations: ['figureInstance', 'instanceNode', 'person', 'compositionSlot'],
      }),
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdB },
        relations: ['figureInstance', 'instanceNode', 'person', 'compositionSlot'],
      }),
    ]);

    if (!assignmentA) {
      throw new NotFoundException(`Assignment ${dto.assignmentIdA} not found`);
    }
    if (!assignmentB) {
      throw new NotFoundException(`Assignment ${dto.assignmentIdB} not found`);
    }
    if (assignmentA.figureInstance.id !== instanceId || assignmentB.figureInstance.id !== instanceId) {
      throw new BadRequestException('Both assignments must belong to the same figure instance');
    }
    if (dto.assignmentIdA === dto.assignmentIdB) {
      throw new BadRequestException('Cannot swap an assignment with itself');
    }

    const nodeIdA = assignmentA.instanceNode.id;
    const nodeIdB = assignmentB.instanceNode.id;

    await this.dataSource.query(
      `UPDATE node_assignments
       SET "personId" = CASE
         WHEN id = $1::uuid THEN $2::uuid
         WHEN id = $3::uuid THEN $4::uuid
       END
       WHERE id IN ($1::uuid, $3::uuid)`,
      [dto.assignmentIdA, assignmentB.person.id, dto.assignmentIdB, assignmentA.person.id],
    );

    const [updatedA, updatedB] = await Promise.all([
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdA },
        relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
      }),
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdB },
        relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
      }),
    ]);

    if (!updatedA || !updatedB) {
      throw new NotFoundException('Failed to reload assignments after swap');
    }

    return { a: toAssignmentDetail(updatedA), b: toAssignmentDetail(updatedB) };
  }

  // ── Existing — unassign ───────────────────────────────────────────────────

  async unassign(instanceId: string, assignmentId: string): Promise<void> {
    await this.checkEventLock(instanceId);

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

  // ── Reset snapshot — wipe all assignments + instance nodes ────────────────

  async resetSnapshot(instanceId: string): Promise<{ removedAssignments: number }> {
    await this.checkEventLock(instanceId);

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }
    if (!instance.snapshotted) {
      throw new BadRequestException('Instance has not been snapshotted yet — nothing to reset');
    }

    const assignmentCount = await this.assignmentRepository.count({
      where: { figureInstance: { id: instanceId } },
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(NodeAssignment, { figureInstance: { id: instanceId } });
      await manager.delete(InstanceNode, { figureInstance: { id: instanceId } });
      await manager.update(FigureInstance, instanceId, {
        snapshotted: false,
      });
    });

    return { removedAssignments: assignmentCount };
  }

  // ── B.6 — History ─────────────────────────────────────────────────────────

  async getHistory(
    templateId: string,
    query: HistoryQueryParams = {},
  ): Promise<{ data: FigureHistoryEntry[]; meta: { total: number; page: number; limit: number } }> {
    const template = await this.figureTemplateRepository.findOne({
      where: { id: templateId },
    });
    if (!template) {
      throw new NotFoundException(`FigureTemplate with ID ${templateId} not found`);
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const qb = this.figureInstanceRepository
      .createQueryBuilder('fi')
      .leftJoinAndSelect('fi.assignments', 'a')
      .leftJoinAndSelect('a.instanceNode', 'ain')
      .leftJoinAndSelect('a.person', 'ap')
      .leftJoinAndSelect('fi.instanceNodes', 'inode')
      .leftJoinAndSelect('fi.segment', 'seg')
      .leftJoinAndSelect('seg.event', 'ev')
      .where('fi.figureTemplateId = :templateId', { templateId });

    if (query.seasonId) {
      qb.andWhere('ev.seasonId = :seasonId', { seasonId: query.seasonId });
    }

    const total = await qb.getCount();
    const instances = await qb
      .orderBy('ev.date', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const data = instances.map((instance) => {
      const event = instance.segment.event as Event;
      return {
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.date as unknown as string,
        eventType: event.eventType,
        segmentName: (instance.segment as any).name ?? null,
        instanceId: instance.id,
        snapshotted: instance.snapshotted,
        assignmentCount: instance.assignments?.length ?? 0,
        totalNodes: instance.instanceNodes?.length ?? 0,
        assignments: (instance.assignments ?? []).map((a) => ({
          nodeId: a.instanceNode.id,
          nodeLabel: a.instanceNode.label,
          personId: a.person.id,
          personAlias: (a.person as any).alias,
        })),
      };
    });

    return { data, meta: { total, page, limit } };
  }

  // ── F3 — Person assignment history ─────────────────────────────────────────

  async getPersonHistory(
    personId: string,
    query: HistoryQueryParams = {},
  ): Promise<PersonAssignmentHistory> {
    const person = await this.personRepository.findOne({ where: { id: personId } });
    if (!person) {
      throw new NotFoundException('Persona no trobada.');
    }

    const page = Math.max(query.page ?? 1, 1);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 100);

    const qb = this.assignmentRepository
      .createQueryBuilder('na')
      .innerJoin('na.instanceNode', 'inode')
      .innerJoin('na.figureInstance', 'fi')
      .innerJoin('fi.segment', 'seg')
      .innerJoin('seg.event', 'ev')
      .leftJoin('fi.figureTemplate', 'tpl')
      .where('na.personId = :personId', { personId })
      .select([
        'ev.id AS "eventId"',
        'ev.title AS "eventTitle"',
        'ev.date AS "eventDate"',
        'ev.eventType AS "eventType"',
        'seg.name AS "segmentName"',
        'fi.id AS "instanceId"',
        'tpl.name AS "figureName"',
        'tpl.slug AS "figureSlug"',
        'inode.label AS "nodeLabel"',
        'inode.positionType AS "positionType"',
        'inode.zone AS "zone"',
        'inode.z AS "z"',
      ]);

    if (query.seasonId) {
      qb.andWhere('ev.seasonId = :seasonId', { seasonId: query.seasonId });
    }

    const total = await qb.getCount();
    const raw = await qb
      .orderBy('"eventDate"', 'DESC')
      .addOrderBy('"segmentName"', 'ASC')
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawMany();

    const data: PersonAssignmentEntry[] = raw.map((r) => ({
      eventId: r.eventId,
      eventTitle: r.eventTitle,
      eventDate: r.eventDate,
      eventType: r.eventType,
      segmentName: r.segmentName ?? '',
      instanceId: r.instanceId,
      figureName: r.figureName ?? '',
      figureSlug: r.figureSlug ?? '',
      nodeLabel: r.nodeLabel,
      positionType: r.positionType ?? null,
      zone: r.zone as FigureZone,
      z: Number(r.z),
    }));

    return { data, meta: { total, page, limit } };
  }

  // ── F3 — Event assignment summary ─────────────────────────────────────────

  async getEventAssignmentSummary(eventId: string): Promise<EventAssignmentSummary> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event no trobat.');
    }

    const segments = await this.eventSegmentRepository.find({
      where: { event: { id: eventId } },
      order: { sortOrder: 'ASC' },
    });

    const result: EventSegmentSummary[] = [];

    for (const segment of segments) {
      const instances = await this.figureInstanceRepository.find({
        where: { segment: { id: segment.id } },
        relations: [
          'figureTemplate',
          'instanceNodes',
          'assignments',
          'assignments.instanceNode',
          'assignments.person',
        ],
      });

      const figures: EventFigureSummary[] = instances.map((fi) => {
        const totalNodes = fi.instanceNodes?.length ?? 0;
        const assignments = (fi.assignments ?? []).map((a) => ({
          nodeLabel: a.instanceNode.label,
          positionType: a.instanceNode.positionType ?? null,
          zone: a.instanceNode.zone as FigureZone,
          z: a.instanceNode.z,
          personAlias: (a.person as any).alias as string,
          personId: a.person.id,
        }));

        return {
          instanceId: fi.id,
          figureName: fi.figureTemplate?.name ?? 'Sense plantilla',
          snapshotted: fi.snapshotted,
          totalNodes,
          assignedNodes: assignments.length,
          assignments,
        };
      });

      result.push({
        segmentId: segment.id,
        segmentName: (segment as any).name ?? '',
        sortOrder: segment.sortOrder,
        figures,
      });
    }

    return { segments: result };
  }


  // ── B.5 — Bulk import with snapshot awareness ─────────────────────────────

  async bulkImport(
    instanceId: string,
    dto: { sourceInstanceId: string; sourceCompositionSlotId?: string },
  ): Promise<BulkImportResult> {
    await this.checkEventLock(instanceId);

    const targetInstance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'compositionTemplate', 'segment', 'instanceNodes'],
    });
    if (!targetInstance) {
      throw new NotFoundException(`Target FigureInstance with ID ${instanceId} not found`);
    }

    const sourceInstance = await this.figureInstanceRepository.findOne({
      where: { id: dto.sourceInstanceId },
      relations: ['instanceNodes'],
    });
    if (!sourceInstance) {
      throw new NotFoundException(`Source FigureInstance with ID ${dto.sourceInstanceId} not found`);
    }

    if (!sourceInstance.snapshotted) {
      throw new BadRequestException('Source instance has no assignments to import (not yet snapshotted)');
    }

    // Auto-snapshot target if needed, then reload with fresh instanceNodes
    if (!targetInstance.snapshotted) {
      await this.snapshotInstance(targetInstance);
      const refreshed = await this.figureInstanceRepository.findOne({
        where: { id: instanceId },
        relations: ['figureTemplate', 'compositionTemplate', 'segment', 'instanceNodes'],
      });
      if (refreshed) {
        targetInstance.snapshotted = refreshed.snapshotted;
        targetInstance.instanceNodes = refreshed.instanceNodes;
      }
    }

    const sourceAssignments = await this.assignmentRepository.find({
      where: {
        figureInstance: { id: dto.sourceInstanceId },
        ...(dto.sourceCompositionSlotId
          ? { compositionSlot: { id: dto.sourceCompositionSlotId } }
          : {}),
      },
      relations: ['instanceNode', 'person', 'compositionSlot', 'figureInstance'],
    });

    const created: AssignmentDetail[] = [];
    const conflicts: BulkImportResult['conflicts'] = [];

    // Primary matching by renglaId + renglaPosition; fallback by sourceNodeId
    const targetByRengla = new Map<string, InstanceNode>();
    const targetBySourceNodeId = new Map<string, InstanceNode>();
    for (const node of targetInstance.instanceNodes ?? []) {
      if (node.renglaId && node.renglaPosition != null) {
        targetByRengla.set(`${node.renglaId}:${node.renglaPosition}`, node);
      }
      if (node.sourceNodeId) {
        targetBySourceNodeId.set(node.sourceNodeId, node);
      }
    }

    for (const sourceAssignment of sourceAssignments) {
      const sourceNode = sourceAssignment.instanceNode;
      const personId = sourceAssignment.person.id;
      const personAlias = (sourceAssignment.person as any).alias;
      const nodeLabel = sourceNode.label;

      let targetNode: InstanceNode | undefined;
      if (sourceNode.renglaId && sourceNode.renglaPosition != null) {
        targetNode = targetByRengla.get(`${sourceNode.renglaId}:${sourceNode.renglaPosition}`);
      }
      if (!targetNode && sourceNode.sourceNodeId) {
        targetNode = targetBySourceNodeId.get(sourceNode.sourceNodeId);
      }

      if (!targetNode) {
        conflicts.push({ nodeId: sourceNode.id, nodeLabel, personAlias, reason: 'No matching node found in target instance' });
        continue;
      }

      const nodeOccupied = await this.assignmentRepository.findOne({
        where: { figureInstance: { id: instanceId }, instanceNode: { id: targetNode.id } },
      });
      if (nodeOccupied) {
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Node already occupied in target instance' });
        continue;
      }

      const personInInstance = await this.assignmentRepository.findOne({
        where: { figureInstance: { id: instanceId }, person: { id: personId } },
      });
      if (personInInstance) {
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Person already assigned in target instance' });
        continue;
      }

      const personInSegment = await this.assignmentRepository
        .createQueryBuilder('a')
        .innerJoin('a.figureInstance', 'fi')
        .where('fi.segmentId = :segmentId', { segmentId: targetInstance.segment.id })
        .andWhere('a.personId = :personId', { personId })
        .getOne();
      if (personInSegment) {
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Person already assigned in this segment' });
        continue;
      }

      try {
        const detail = await this.assign(instanceId, {
          nodeId: targetNode.id,
          personId,
          compositionSlotId: undefined,
        });
        created.push(detail);
      } catch {
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Could not create assignment' });
      }
    }

    return { created, conflicts };
  }


  // ── Cordons — update numberOfCordons / openCordons on instance ─────────────

  async updateCordons(
    instanceId: string,
    dto: { numberOfCordons?: number | null; openCordons?: string[] | null },
  ): Promise<{ numberOfCordons: number | null; openCordons: string[] | null }> {
    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    if (dto.numberOfCordons !== undefined) {
      instance.numberOfCordons = dto.numberOfCordons;
    }
    if (dto.openCordons !== undefined) {
      instance.openCordons = dto.openCordons;
    }

    await this.figureInstanceRepository.save(instance);

    return {
      numberOfCordons: instance.numberOfCordons,
      openCordons: instance.openCordons,
    };
  }

  // ── Lock — Assignment lock after event date ────────────────────────────────

  async getLockStatus(eventId: string): Promise<{ locked: boolean; lockDate: string | null; lockDays: number }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const lockDays = parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
    if (lockDays <= 0) {
      return { locked: false, lockDate: null, lockDays: 0 };
    }

    const eventDate = new Date(event.date);
    const lockDate = new Date(eventDate);
    lockDate.setDate(lockDate.getDate() + lockDays);

    return {
      locked: new Date() > lockDate,
      lockDate: lockDate.toISOString().slice(0, 10),
      lockDays,
    };
  }

  private async checkEventLock(instanceId: string): Promise<void> {
    const lockDays = parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
    if (lockDays <= 0) return;

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['segment', 'segment.event'],
    });
    if (!instance?.segment) return;

    const event = instance.segment.event as Event;
    if (!event) return;

    const eventDate = new Date(event.date);
    const lockDate = new Date(eventDate);
    lockDate.setDate(lockDate.getDate() + lockDays);

    if (new Date() > lockDate) {
      throw new ForbiddenException(
        `Les assignacions d'aquest event estan bloquejades (event del ${eventDate.toISOString().slice(0, 10)}, bloqueig després de ${lockDays} dies).`,
      );
    }
  }

  // ── B.1 — Snapshot helper ─────────────────────────────────────────────────

  /**
   * Copies all FigureNode rows from the instance's template into InstanceNode rows
   * owned by this instance. Marks the instance as snapshotted. Runs in a transaction.
   * Returns the newly created InstanceNode rows.
   */
  private async snapshotInstance(instance: FigureInstance): Promise<InstanceNode[]> {
    if (!instance.figureTemplate) {
      throw new BadRequestException('Cannot snapshot a composition-based instance');
    }

    const template = await this.figureTemplateRepository.findOne({
      where: { id: instance.figureTemplate.id },
      relations: ['nodes'],
    });

    if (!template) {
      throw new NotFoundException(`FigureTemplate ${instance.figureTemplate.id} not found`);
    }

    const allNodes = template.nodes ?? [];

    return this.dataSource.transaction(async (manager) => {
      const instanceNodes = allNodes.map((node) =>
        manager.create(InstanceNode, {
          figureInstance: instance,
          sourceNodeId: node.id,
          originNodeId: node.originNodeId,
          label: node.label,
          zone: node.zone,
          positionType: node.positionType,
          x: node.x,
          y: node.y,
          z: node.z,
          width: node.width,
          height: node.height,
          rotation: node.rotation,
          color: node.color,
          shape: node.shape,
          sortOrder: node.sortOrder,
          climbPath: node.climbPath,
          ringLevel: node.ringLevel,
          renglaId: node.renglaId,
          renglaPosition: node.renglaPosition,
          metadata: node.metadata,
        }),
      );

      const saved = await manager.save(InstanceNode, instanceNodes);

      await manager.update(FigureInstance, instance.id, {
        snapshotted: true,
      });

      return saved;
    });
  }
}
