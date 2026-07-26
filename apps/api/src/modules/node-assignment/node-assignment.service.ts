import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import {
  EventType,
  FigureMode,
  FigureZone,
  NodeShape,
  PINYA_NODE_PRESETS,
  DECORATION_NODE_PRESETS,
  DIRECTION_NODE_PRESETS,
  SegmentMoveConflictResolution,
} from '@muixer/shared';
import { CreateAdHocNodeDto } from './dto/create-ad-hoc-node.dto';
import { UpdateAdHocNodeDto } from './dto/update-ad-hoc-node.dto';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { Event } from '../event/event.entity';

// ─── Response interfaces ────────────────────────────────────────────────────

export interface AssignmentDetail {
  id: string;
  figureInstanceId: string;
  node: {
    id: string;
    label: string;
    zone: string;
    z: number;
    positionType: string | null;
    sortOrder: number;
    climbIndicator: string | null;
    ringLevel: number | null;
    originNodeId: string | null;
    sourceNodeId: string | null;
    renglaPosition: number | null;
  };
  person: {
    id: string;
    alias: string;
    name: string;
    firstSurname: string;
    shoulderHeight: number | null;
    notes: string | null;
    notesEmoji: string | null;
  };
}

export interface SegmentMoveConflict {
  personId: string;
  /** true if the person occupies a TRONC/BASE node in either the moving instance or the target segment */
  isTronc: boolean;
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
  climbIndicator: string | null;
  ringLevel: number | null;
  renglaId: string | null;
  renglaPosition: number | null;
  isSnapshotted: boolean;
  isAdHoc: boolean;
  createdById: string | null;
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
  clonedAdHocNodes: number;
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
  renglaPosition: number | null;
}

export interface PersonAssignmentHistory {
  data: PersonAssignmentEntry[];
  meta: { total: number; page: number; limit: number };
}

export interface FigureAreaCount {
  assigned: number;
  total: number;
}

export interface EventFigureSummary {
  instanceId: string;
  figureName: string;
  snapshotted: boolean;
  /** PINYA nodes only, filtered by numberOfCordons/cordonsObertsEnabled and zeroed for REMAT/NETA. */
  pinya: FigureAreaCount;
  /** TRONC + BASE nodes (BASE excluded for REMAT). */
  tronc: FigureAreaCount;
  /** pinya + tronc + direction nodes; DECORATION excluded (not assignable). */
  total: FigureAreaCount;
  /** TRONC/BASE assignments only, unfiltered by figureMode — still needed for name display. */
  troncBaseAssignments: {
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
    node: {
      id: node.id,
      label: node.label,
      zone: node.zone,
      z: node.z,
      positionType: node.positionType,
      sortOrder: node.sortOrder,
      climbIndicator: node.climbIndicator,
      ringLevel: node.ringLevel,
      originNodeId: node.originNodeId,
      sourceNodeId: node.sourceNodeId,
      renglaPosition: node.renglaPosition,
    },
    person: {
      id: assignment.person.id,
      alias: assignment.person.alias,
      name: assignment.person.name,
      firstSurname: assignment.person.firstSurname,
      shoulderHeight: assignment.person.shoulderHeight ?? null,
      notes: assignment.person.notes ?? null,
      notesEmoji: assignment.person.notesEmoji ?? null,
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
    climbIndicator: node.climbIndicator,
    ringLevel: node.ringLevel,
    renglaId: node.renglaId,
    renglaPosition: node.renglaPosition,
    isSnapshotted: true,
    isAdHoc: node.isAdHoc ?? false,
    createdById: node.createdById ?? null,
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
    climbIndicator: node.climbIndicator,
    ringLevel: node.ringLevel,
    renglaId: node.renglaId,
    renglaPosition: node.renglaPosition,
    isSnapshotted: false,
    isAdHoc: false,
    createdById: null,
  };
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
      relations: ['instanceNode', 'person', 'figureInstance'],
    });

    return assignments.map(toAssignmentDetail);
  }

  // ── B.2 — assign with auto-snapshot ───────────────────────────────────────

  async assign(
    instanceId: string,
    dto: { nodeId: string; personId: string },
  ): Promise<AssignmentDetail> {
    await this.checkEventLock(instanceId);

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'segment'],
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

    if (instanceNode.zone === FigureZone.DECORATION) {
      throw new BadRequestException('Els nodes decoratius no es poden assignar.');
    }

    const person = await this.personRepository.findOne({ where: { id: dto.personId } });
    if (!person) {
      throw new NotFoundException(`Person with ID ${dto.personId} not found`);
    }

    const nodeConflict = await this.assignmentRepository.findOne({
      where: {
        figureInstance: { id: instanceId },
        instanceNode: { id: instanceNode.id },
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
      segment: instance.segment,
    });

    let saved: NodeAssignment;
    try {
      saved = await this.assignmentRepository.save(assignment);
    } catch (err) {
      throw this.toAssignConflictError(err);
    }

    const populated = await this.assignmentRepository.findOne({
      where: { id: saved.id },
      relations: ['instanceNode', 'person', 'figureInstance'],
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
        relations: ['figureInstance', 'figureInstance.segment', 'instanceNode', 'person'],
      }),
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdB },
        relations: ['figureInstance', 'figureInstance.segment', 'instanceNode', 'person'],
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

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(NodeAssignment, { id: dto.assignmentIdA });
      await manager.delete(NodeAssignment, { id: dto.assignmentIdB });

      const newA = manager.create(NodeAssignment, {
        id: dto.assignmentIdA,
        figureInstance: assignmentA.figureInstance,
        instanceNode: assignmentA.instanceNode,
        person: assignmentB.person,
        segment: assignmentA.figureInstance.segment,
      });
      const newB = manager.create(NodeAssignment, {
        id: dto.assignmentIdB,
        figureInstance: assignmentB.figureInstance,
        instanceNode: assignmentB.instanceNode,
        person: assignmentA.person,
        segment: assignmentB.figureInstance.segment,
      });

      await manager.save(NodeAssignment, [newA, newB]);
    });

    const [updatedA, updatedB] = await Promise.all([
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdA },
        relations: ['instanceNode', 'person', 'figureInstance'],
      }),
      this.assignmentRepository.findOne({
        where: { id: dto.assignmentIdB },
        relations: ['instanceNode', 'person', 'figureInstance'],
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

  // ── Segment move — cross-segment person conflicts ──────────────────────────

  async getSegmentMoveConflicts(
    instanceId: string,
    targetSegmentId: string,
  ): Promise<SegmentMoveConflict[]> {
    const [movingAssignments, targetAssignments] = await Promise.all([
      this.assignmentRepository.find({
        where: { figureInstance: { id: instanceId } },
        relations: ['instanceNode', 'person'],
      }),
      this.assignmentRepository.find({
        where: { segment: { id: targetSegmentId } },
        relations: ['instanceNode', 'person'],
      }),
    ]);

    const TRONC_ZONES = new Set([FigureZone.TRONC, FigureZone.BASE]);
    const targetByPersonId = new Map(targetAssignments.map((a) => [a.person.id, a]));

    return movingAssignments
      .filter((a) => targetByPersonId.has(a.person.id))
      .map((a) => {
        const targetAssignment = targetByPersonId.get(a.person.id)!;
        const isTronc =
          TRONC_ZONES.has(a.instanceNode.zone as FigureZone) ||
          TRONC_ZONES.has(targetAssignment.instanceNode.zone as FigureZone);
        return { personId: a.person.id, isTronc };
      });
  }

  async resolveSegmentMoveConflicts(
    instanceId: string,
    targetSegmentId: string,
    personIds: string[],
    resolution: SegmentMoveConflictResolution,
    manager: EntityManager,
  ): Promise<void> {
    if (personIds.length === 0) return;

    if (resolution === SegmentMoveConflictResolution.KEEP_TARGET) {
      await manager.delete(NodeAssignment, {
        figureInstance: { id: instanceId },
        person: In(personIds),
      });
    } else {
      await manager.delete(NodeAssignment, {
        segment: { id: targetSegmentId },
        person: In(personIds),
      });
    }
  }

  // ── Reset snapshot — wipe all assignments + instance nodes ────────────────

  async resetSnapshot(instanceId: string): Promise<{ removedAssignments: number; deletedAdHocCount: number }> {
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

    const adHocCount = await this.instanceNodeRepository.count({
      where: { figureInstance: { id: instanceId }, isAdHoc: true },
    });

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(NodeAssignment, { figureInstance: { id: instanceId } });
      await manager.delete(InstanceNode, { figureInstance: { id: instanceId } });
      await manager.update(FigureInstance, instanceId, {
        snapshotted: false,
      });
    });

    return { removedAssignments: assignmentCount, deletedAdHocCount: adHocCount };
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
        segmentName: instance.segment.name ?? null,
        instanceId: instance.id,
        snapshotted: instance.snapshotted,
        assignmentCount: instance.assignments?.length ?? 0,
        totalNodes: instance.instanceNodes?.length ?? 0,
        assignments: (instance.assignments ?? []).map((a) => ({
          nodeId: a.instanceNode.id,
          nodeLabel: a.instanceNode.label,
          personId: a.person.id,
          personAlias: a.person.alias,
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
        'inode.renglaPosition AS "renglaPosition"',
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
      renglaPosition: r.renglaPosition !== null && r.renglaPosition !== undefined ? Number(r.renglaPosition) : null,
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
          'figureTemplate.nodes',
          'instanceNodes',
          'assignments',
          'assignments.instanceNode',
          'assignments.person',
        ],
      });

      const figures: EventFigureSummary[] = instances.map((fi) => ({
        instanceId: fi.id,
        figureName: fi.figureTemplate?.name ?? 'Sense plantilla',
        snapshotted: fi.snapshotted,
        ...this.computeInstanceAreaSummary(fi),
      }));

      result.push({
        segmentId: segment.id,
        segmentName: segment.name ?? '',
        sortOrder: segment.sortOrder,
        figures,
      });
    }

    return { segments: result };
  }

  /**
   * Buckets a figure instance's nodes/assignments into pinya/tronc/total area
   * counts, applying the same visibility rules used elsewhere for capacity:
   * PINYA nodes respect numberOfCordons + cordonsObertsEnabled and are zeroed
   * for REMAT/NETA; BASE counts as tronc except for REMAT; direction nodes
   * (FIGURE_DIRECTION/XICALLA_DIRECTION) count only toward total; DECORATION
   * is excluded entirely (not assignable).
   */
  private computeInstanceAreaSummary(fi: FigureInstance): {
    pinya: FigureAreaCount;
    tronc: FigureAreaCount;
    total: FigureAreaCount;
    troncBaseAssignments: EventFigureSummary['troncBaseAssignments'];
  } {
    const nodes = fi.snapshotted ? (fi.instanceNodes ?? []) : (fi.figureTemplate?.nodes ?? []);
    const figureMode = fi.figureMode ?? FigureMode.COMPLETA;
    const numberOfCordons = fi.numberOfCordons ?? null;
    const cordonsObertsEnabled = fi.cordonsObertsEnabled;

    const isPinya = (n: { zone: string; positionType: string | null; renglaPosition: number | null }): boolean => {
      if (n.zone !== FigureZone.PINYA) return false;
      if (figureMode === FigureMode.REMAT || figureMode === FigureMode.NETA) return false;
      if (n.positionType === 'cordo-obert') return cordonsObertsEnabled;
      if (numberOfCordons === null) return true;
      return n.renglaPosition === null || n.renglaPosition <= numberOfCordons;
    };
    const isTronc = (n: { zone: string }): boolean =>
      n.zone === FigureZone.TRONC || (n.zone === FigureZone.BASE && figureMode !== FigureMode.REMAT);
    const isDirection = (n: { zone: string }): boolean =>
      n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION;

    let pinyaTotal = 0;
    let troncTotal = 0;
    let directionTotal = 0;
    for (const n of nodes) {
      if (isPinya(n)) pinyaTotal++;
      else if (isTronc(n)) troncTotal++;
      else if (isDirection(n)) directionTotal++;
    }

    let pinyaAssigned = 0;
    let troncAssigned = 0;
    let directionAssigned = 0;
    const troncBaseAssignments: EventFigureSummary['troncBaseAssignments'] = [];
    for (const a of fi.assignments ?? []) {
      const n = a.instanceNode;
      if (!n) continue;
      if (isPinya(n)) {
        pinyaAssigned++;
      } else if (isTronc(n)) {
        troncAssigned++;
      } else if (isDirection(n)) {
        directionAssigned++;
      }
      if (n.zone === FigureZone.TRONC || n.zone === FigureZone.BASE) {
        troncBaseAssignments.push({
          nodeLabel: n.label,
          positionType: n.positionType ?? null,
          zone: n.zone as FigureZone,
          z: n.z,
          personAlias: a.person.alias as string,
          personId: a.person.id,
        });
      }
    }

    return {
      pinya: { assigned: pinyaAssigned, total: pinyaTotal },
      tronc: { assigned: troncAssigned, total: troncTotal },
      total: {
        assigned: pinyaAssigned + troncAssigned + directionAssigned,
        total: pinyaTotal + troncTotal + directionTotal,
      },
      troncBaseAssignments,
    };
  }


  // ── B.5 — Bulk import with snapshot awareness ─────────────────────────────

  async bulkImport(
    instanceId: string,
    dto: { sourceInstanceId: string },
  ): Promise<BulkImportResult> {
    await this.checkEventLock(instanceId);

    const targetInstance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'segment', 'instanceNodes'],
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
        relations: ['figureTemplate', 'segment', 'instanceNodes'],
      });
      if (refreshed) {
        targetInstance.snapshotted = refreshed.snapshotted;
        targetInstance.instanceNodes = refreshed.instanceNodes;
      }
    }

    const sourceAssignments = await this.assignmentRepository.find({
      where: {
        figureInstance: { id: dto.sourceInstanceId },
      },
      relations: ['instanceNode', 'person', 'figureInstance'],
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
      if (sourceNode.isAdHoc) continue; // ad-hoc assignments handled below
      const personId = sourceAssignment.person.id;
      const personAlias = sourceAssignment.person.alias;
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
        });
        created.push(detail);
      } catch {
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason: 'Could not create assignment' });
      }
    }

    // Clone ad-hoc nodes from source to target (idempotent via originNodeId)
    const sourceAdHocNodes = (sourceInstance.instanceNodes ?? []).filter(
      (n) => n.isAdHoc,
    );
    let clonedAdHocNodes = 0;

    const existingTargetAdHoc = await this.instanceNodeRepository.find({
      where: { figureInstance: { id: instanceId }, isAdHoc: true },
      select: ['id', 'originNodeId'],
    });
    const existingOriginIds = new Set(
      existingTargetAdHoc.filter((n) => n.originNodeId).map((n) => n.originNodeId),
    );

    const maxSortOrder = await this.instanceNodeRepository
      .createQueryBuilder('n')
      .where('n.figureInstanceId = :id', { id: instanceId })
      .select('MAX(n.sortOrder)', 'max')
      .getRawOne();
    let nextSortOrder = (maxSortOrder?.max ?? 0) + 1;

    const sourceAdHocAssignmentMap = new Map<string, NodeAssignment>();
    for (const sa of sourceAssignments) {
      if (sa.instanceNode.isAdHoc) {
        sourceAdHocAssignmentMap.set(sa.instanceNode.id, sa);
      }
    }

    for (const sourceAdHoc of sourceAdHocNodes) {
      if (existingOriginIds.has(sourceAdHoc.id)) {
        continue;
      }

      const cloned = this.instanceNodeRepository.create({
        figureInstance: targetInstance,
        sourceNodeId: null,
        originNodeId: sourceAdHoc.id,
        label: sourceAdHoc.label,
        zone: sourceAdHoc.zone,
        positionType: sourceAdHoc.positionType,
        x: sourceAdHoc.x,
        y: sourceAdHoc.y,
        z: sourceAdHoc.z,
        width: sourceAdHoc.width,
        height: sourceAdHoc.height,
        rotation: sourceAdHoc.rotation,
        color: sourceAdHoc.color,
        shape: sourceAdHoc.shape,
        sortOrder: nextSortOrder++,
        climbIndicator: sourceAdHoc.climbIndicator,
        ringLevel: sourceAdHoc.ringLevel,
        renglaId: null,
        renglaPosition: null,
        metadata: sourceAdHoc.metadata ?? {},
        isAdHoc: true,
        createdById: null,
      });
      const savedClone = await this.instanceNodeRepository.save(cloned);
      clonedAdHocNodes++;

      const sourceAssignment = sourceAdHocAssignmentMap.get(sourceAdHoc.id);
      if (
        sourceAssignment &&
        sourceAssignment.person &&
        sourceAdHoc.zone !== FigureZone.DECORATION
      ) {
        const personId = sourceAssignment.person.id;
        const personAlias = sourceAssignment.person.alias ?? `${sourceAssignment.person.name} ${sourceAssignment.person.firstSurname}`;
        try {
          await this.assign(instanceId, {
            nodeId: savedClone.id,
            personId,
          });
        } catch {
          conflicts.push({
            nodeId: savedClone.id,
            nodeLabel: sourceAdHoc.label,
            personAlias,
            reason: 'No s\'ha pogut clonar l\'assignació ad-hoc',
          });
        }
      }
    }

    return { created, conflicts, clonedAdHocNodes };
  }


  // ── Cordons — update numberOfCordons on instance ────────────────────────────

  async updateCordons(
    instanceId: string,
    dto: { numberOfCordons?: number | null; cordonsObertsEnabled?: boolean },
  ): Promise<{ numberOfCordons: number | null; cordonsObertsEnabled: boolean }> {
    await this.checkEventLock(instanceId);

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    const disablingCordonsOberts = dto.cordonsObertsEnabled === false && instance.cordonsObertsEnabled !== false;

    if (dto.numberOfCordons !== undefined) {
      instance.numberOfCordons = dto.numberOfCordons;
    }
    if (dto.cordonsObertsEnabled !== undefined) {
      instance.cordonsObertsEnabled = dto.cordonsObertsEnabled;
    }

    await this.figureInstanceRepository.save(instance);

    if (instance.numberOfCordons !== null) {
      await this.removeAssignmentsBeyondCordons(instanceId, instance.numberOfCordons);
    }
    if (disablingCordonsOberts) {
      await this.removeCordoObertAssignments(instanceId);
    }

    return { numberOfCordons: instance.numberOfCordons, cordonsObertsEnabled: instance.cordonsObertsEnabled };
  }

  /**
   * Deletes assignments on PINYA nodes whose renglaPosition falls beyond
   * numberOfCordons — those nodes become hidden from the assignment UI, so an
   * assignment on one would otherwise silently linger and reappear if cordons
   * are later increased again. cordo-obert nodes are exempt: they stay
   * assignable regardless of numberOfCordons.
   */
  private async removeAssignmentsBeyondCordons(instanceId: string, numberOfCordons: number): Promise<void> {
    const hiddenNodes = await this.instanceNodeRepository.find({
      where: { figureInstance: { id: instanceId } },
    });
    const hiddenNodeIds = hiddenNodes
      .filter(
        (n) =>
          n.zone === FigureZone.PINYA &&
          n.positionType !== 'cordo-obert' &&
          n.renglaPosition !== null &&
          n.renglaPosition > numberOfCordons,
      )
      .map((n) => n.id);
    if (hiddenNodeIds.length === 0) return;

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId }, instanceNode: { id: In(hiddenNodeIds) } },
      relations: ['instanceNode'],
    });
    if (assignments.length === 0) return;

    await this.assignmentRepository.remove(assignments);
  }

  /**
   * Deletes assignments on cordo-obert nodes — called when cordonsObertsEnabled
   * is turned off, since those nodes become hidden from the assignment UI.
   */
  private async removeCordoObertAssignments(instanceId: string): Promise<void> {
    const nodes = await this.instanceNodeRepository.find({
      where: { figureInstance: { id: instanceId } },
    });
    const cordoObertNodeIds = nodes.filter((n) => n.positionType === 'cordo-obert').map((n) => n.id);
    if (cordoObertNodeIds.length === 0) return;

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId }, instanceNode: { id: In(cordoObertNodeIds) } },
      relations: ['instanceNode'],
    });
    if (assignments.length === 0) return;

    await this.assignmentRepository.remove(assignments);
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

  /**
   * Variant of checkEventLock for mutations that don't hang off a FigureInstance
   * (segment CRUD/reorder, instance creation/reorder, composition apply).
   */
  async checkEventLockByEventId(eventId: string): Promise<void> {
    const lockDays = parseInt(process.env.ASSIGNMENT_LOCK_DAYS ?? '2', 10);
    if (lockDays <= 0) return;

    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) return;

    const eventDate = new Date(event.date);
    const lockDate = new Date(eventDate);
    lockDate.setDate(lockDate.getDate() + lockDays);

    if (new Date() > lockDate) {
      throw new ForbiddenException(
        `Aquest event està bloquejat (event del ${eventDate.toISOString().slice(0, 10)}, bloqueig després de ${lockDays} dies).`,
      );
    }
  }

  /** Shared by NodeAssignmentService's own mutations and by FigureInstanceService for the paths that also touch assignment data (mode change, instance removal). */
  async checkEventLock(instanceId: string): Promise<void> {
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

  // ── Ad-hoc node CRUD ─────────────────────────────────────────────────────

  async createAdHocNode(
    instanceId: string,
    dto: CreateAdHocNodeDto,
    userId: string,
  ): Promise<InstanceNodeResponse> {
    await this.checkEventLock(instanceId);

    const instance = await this.figureInstanceRepository.findOne({
      where: { id: instanceId },
      relations: ['figureTemplate', 'segment'],
    });
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }

    this.assertNotComposition(instance);

    if (!instance.snapshotted) {
      await this.snapshotInstance(instance);
      instance.snapshotted = true;
    }

    const allPresets = [...PINYA_NODE_PRESETS, ...DECORATION_NODE_PRESETS, ...DIRECTION_NODE_PRESETS];
    const preset = allPresets.find(
      (p) => p.positionType === dto.positionType && p.zone === dto.zone,
    );

    const saved = await this.dataSource.transaction(async (manager) => {
      const maxResult = await manager
        .createQueryBuilder(InstanceNode, 'n')
        .where('n.figureInstanceId = :id', { id: instanceId })
        .select('MAX(n.sortOrder)', 'max')
        .getRawOne();
      const nextSortOrder = (maxResult?.max ?? 0) + 1;

      const node = manager.create(InstanceNode, {
        figureInstance: instance,
        sourceNodeId: null,
        originNodeId: null,
        label: dto.label,
        zone: dto.zone,
        positionType: dto.positionType ?? null,
        x: dto.x,
        y: dto.y,
        z: 0,
        width: dto.width ?? preset?.width ?? 80,
        height: dto.height ?? preset?.height ?? 40,
        rotation: dto.rotation ?? 0,
        color:
          dto.color ??
          (dto.zone === FigureZone.DECORATION
            ? (preset?.color ?? null)
            : (preset?.color ?? '#B0BEC5')),
        shape: dto.shape ?? preset?.shape ?? NodeShape.RECTANGLE,
        sortOrder: nextSortOrder,
        climbIndicator: null,
        ringLevel: null,
        renglaId: null,
        renglaPosition: null,
        metadata: {},
        isAdHoc: true,
        createdById: userId,
      } as Partial<InstanceNode>);

      return manager.save(node);
    });

    return instanceNodeToResponse(saved as InstanceNode);
  }

  async updateAdHocNode(
    instanceId: string,
    nodeId: string,
    dto: UpdateAdHocNodeDto,
  ): Promise<InstanceNodeResponse> {
    await this.checkEventLock(instanceId);

    const node = await this.instanceNodeRepository.findOne({
      where: { id: nodeId, figureInstance: { id: instanceId } },
    });
    if (!node) {
      throw new NotFoundException(`InstanceNode with ID ${nodeId} not found in this instance`);
    }
    if (!node.isAdHoc) {
      throw new ForbiddenException('No es pot modificar un node del template.');
    }

    if (dto.label !== undefined) node.label = dto.label;
    if (dto.x !== undefined) node.x = dto.x;
    if (dto.y !== undefined) node.y = dto.y;
    if (dto.width !== undefined) node.width = dto.width;
    if (dto.height !== undefined) node.height = dto.height;
    if (dto.rotation !== undefined) node.rotation = dto.rotation;
    if (dto.color !== undefined) node.color = dto.color;
    if (dto.shape !== undefined) node.shape = dto.shape;

    const updated = await this.instanceNodeRepository.save(node);
    return instanceNodeToResponse(updated);
  }

  async deleteAdHocNode(instanceId: string, nodeId: string): Promise<void> {
    await this.checkEventLock(instanceId);

    const node = await this.instanceNodeRepository.findOne({
      where: { id: nodeId, figureInstance: { id: instanceId } },
    });
    if (!node) {
      throw new NotFoundException(`InstanceNode with ID ${nodeId} not found in this instance`);
    }
    if (!node.isAdHoc) {
      throw new ForbiddenException('No es pot eliminar un node del template.');
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(NodeAssignment, { instanceNode: { id: nodeId } });
      await manager.delete(InstanceNode, { id: nodeId });
    });
  }

  private assertNotComposition(_instance: FigureInstance): void {
    // compositions removed in Phase 0
  }

  /**
   * Translates a Postgres unique-violation (23505) racing another concurrent
   * assign() into the same ConflictException the pre-checks throw, instead of
   * letting it surface as a raw 500 (BUG-18). Any other error is rethrown as-is.
   */
  private toAssignConflictError(err: unknown): Error {
    const pgErr = err as { code?: string; detail?: string };
    if (pgErr?.code !== '23505') return err as Error;
    if (pgErr.detail?.includes('segmentId')) {
      return new ConflictException('Person is already assigned in another figure instance of this segment');
    }
    if (pgErr.detail?.includes('personId')) {
      return new ConflictException('Person is already assigned in this figure instance');
    }
    return new ConflictException('Node is already occupied in this figure instance');
  }

  // ── B.1 — Snapshot helper ─────────────────────────────────────────────────

  /**
   * Copies all FigureNode rows from the instance's template into InstanceNode rows
   * owned by this instance. Marks the instance as snapshotted. Runs in a transaction.
   * Returns the InstanceNode rows for the instance (freshly created, or — if a
   * concurrent caller already snapshotted it first — the winner's rows).
   *
   * The `UPDATE ... WHERE snapshotted = false` below is an atomic claim (BUG-17):
   * Postgres serializes concurrent UPDATEs on the same row, so a second caller's
   * claim blocks until the first commits, then correctly loses (0 rows affected)
   * instead of both callers copying the template nodes twice.
   */
  private async snapshotInstance(instance: FigureInstance): Promise<InstanceNode[]> {
    if (!instance.figureTemplate) {
      throw new BadRequestException('Cannot snapshot a composition-based instance');
    }
    const figureTemplateId = instance.figureTemplate.id;

    return this.dataSource.transaction(async (manager) => {
      const claim = await manager.update(
        FigureInstance,
        { id: instance.id, snapshotted: false },
        { snapshotted: true },
      );

      if (!claim.affected) {
        return manager.find(InstanceNode, { where: { figureInstance: { id: instance.id } } });
      }

      const template = await this.figureTemplateRepository.findOne({
        where: { id: figureTemplateId },
        relations: ['nodes'],
      });

      if (!template) {
        throw new NotFoundException(`FigureTemplate ${figureTemplateId} not found`);
      }

      const instanceNodes = (template.nodes ?? []).map((node) =>
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
          climbIndicator: node.climbIndicator,
          ringLevel: node.ringLevel,
          renglaId: node.renglaId,
          renglaPosition: node.renglaPosition,
          metadata: node.metadata,
        }),
      );

      return manager.save(InstanceNode, instanceNodes);
    });
  }
}
