import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Logger,
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
  AssignmentArea,
  SegmentConflictKind,
  areaForZone,
  classifyPlacementKind,
  isNodeVisibleByCordons,
  ConflictPlacement,
  SegmentConflict,
  SegmentConflictsResponse,
  SegmentPeopleCounters,
  TroncChangeImpact,
  EventAssignmentSummary,
  EventSegmentSummary,
  EventFigureSummary,
  FigureAreaCount,
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

/**
 * Conflict raised by assign()'s own checks (or the DB race backstop in
 * toAssignConflictError). Carries a machine-readable `reasonCode` so bulkImport
 * can classify it without parsing `message` — substring matching breaks silently
 * if the message wording ever changes.
 */
export type AssignConflictReasonCode = 'NODE_OCCUPIED';

export class AssignConflictException extends ConflictException {
  constructor(message: string, public readonly reasonCode: AssignConflictReasonCode) {
    super(message);
  }
}

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

/** One placement of a person involved in a cross-segment move conflict. */
interface MoveConflictPlacement {
  assignmentId: string;
  zone: FigureZone;
  area: AssignmentArea;
}

export interface SegmentMoveConflict {
  personId: string;
  /** Every placement of this person across the moving instance and the target segment, tronc-area first. */
  placements: MoveConflictPlacement[];
  /** Drives ordering and the one-tap suggestion (§4.1), not the visual style. */
  kind: SegmentConflictKind;
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
  /**
   * D5 (docs/SEGMENTS_FLEXIBILITY.md, Fase 5): duplicates are now imported, not skipped —
   * only node-occupied/no-matching-node rows still land in `conflicts` above. This reports
   * how many of the resulting segment conflicts fall in each kind, over the target segment
   * as a whole (not just the rows this import touched).
   */
  conflictsByKind: Record<SegmentConflictKind, number>;
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

// FigureAreaCount, EventFigureSummary, EventSegmentSummary and EventAssignmentSummary
// live in @muixer/shared (imported above). They used to be redeclared here — a
// duplication that forced every Fase-1 field to be added twice; now there is a single
// source (#2). The dashboard still holds its own stale copy, to be unified in Fase 3.

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
  private readonly logger = new Logger(NodeAssignmentService.name);

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
  ): Promise<AssignmentDetail & { impact?: TroncChangeImpact }> {
    await this.checkEventLock(instanceId);
    return this.assignWithoutLockCheck(instanceId, dto, true);
  }

  /**
   * Same as assign(), but skips checkEventLock(). bulkImport() already checks
   * the lock once before its loop (B4): calling assign() per node would re-run
   * that same findOne+2-relations query on every iteration for no benefit.
   */
  private async assignWithoutLockCheck(
    instanceId: string,
    dto: { nodeId: string; personId: string },
    computeImpact = false,
  ): Promise<AssignmentDetail & { impact?: TroncChangeImpact }> {
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
      throw new AssignConflictException(
        `Node ${instanceNode.id} is already occupied in this figure instance`,
        'NODE_OCCUPIED',
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

    const detail = toAssignmentDetail(populated!);
    if (computeImpact && areaForZone(instanceNode.zone as FigureZone) === AssignmentArea.TRONC) {
      return { ...detail, impact: await this.computeTroncChangeImpact(instance.segment.id, instanceId) };
    }
    return detail;
  }

  /**
   * Derived impact of writing to a TRONC/BASE node (D11): the segment's conflicts after the
   * write, plus the touched instance's pinya nodes that are now empty. Not persisted; consumed
   * from Phase 4 and by FigureInstanceService.move() (Fase 5). Reuses the canonical
   * getSegmentConflicts (D13) — no bespoke conflict logic. Public: move() lives in a
   * different service and needs the same computation.
   */
  async computeTroncChangeImpact(
    segmentId: string,
    instanceId: string,
  ): Promise<TroncChangeImpact> {
    const [{ data: newConflicts }, freedPinyaNodeIds] = await Promise.all([
      this.getSegmentConflicts(segmentId),
      this.computeFreedPinyaNodeIds(instanceId),
    ]);
    return { newConflicts, freedPinyaNodeIds };
  }

  /**
   * Pinya-area InstanceNodes of an instance that currently hold no assignment (areaForZone:
   * BASE→TRONC), excluding nodes hidden by the instance's cordons/mode setup (R9) — a node
   * hidden beyond `numberOfCordons` or zeroed by REMAT/NETA is not something to "review".
   */
  private async computeFreedPinyaNodeIds(instanceId: string): Promise<string[]> {
    const [instance, nodes, assignments] = await Promise.all([
      this.figureInstanceRepository.findOne({ where: { id: instanceId } }),
      this.instanceNodeRepository.find({ where: { figureInstance: { id: instanceId } } }),
      this.assignmentRepository.find({
        where: { figureInstance: { id: instanceId } },
        relations: ['instanceNode'],
      }),
    ]);
    const cordonsOpts = {
      figureMode: instance?.figureMode ?? FigureMode.COMPLETA,
      numberOfCordons: instance?.numberOfCordons ?? null,
      cordonsObertsEnabled: instance?.cordonsObertsEnabled ?? true,
    };
    const occupied = new Set(assignments.map((a) => a.instanceNode?.id).filter(Boolean));
    return nodes
      .filter(
        (n) =>
          areaForZone(n.zone as FigureZone) === AssignmentArea.PINYA &&
          !occupied.has(n.id) &&
          isNodeVisibleByCordons(n, cordonsOpts),
      )
      .map((n) => n.id);
  }

  // ── B.7 — Swap two assignments ────────────────────────────────────────────

  async swap(
    instanceId: string,
    dto: { assignmentIdA: string; assignmentIdB: string },
  ): Promise<{ a: AssignmentDetail; b: AssignmentDetail; impact?: TroncChangeImpact }> {
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

    try {
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
    } catch (err) {
      // Fase 5 (risc 10, §7 Fase 5.3): swap() never used to catch the unique-violation
      // race on the one constraint that still applies (UQ_node_assignments_instance_node).
      throw this.toAssignConflictError(err);
    }

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

    const result = { a: toAssignmentDetail(updatedA), b: toAssignmentDetail(updatedB) };
    const touchesTronc = [assignmentA, assignmentB].some(
      (x) => areaForZone(x.instanceNode.zone as FigureZone) === AssignmentArea.TRONC,
    );
    if (touchesTronc) {
      return {
        ...result,
        impact: await this.computeTroncChangeImpact(assignmentA.figureInstance.segment.id, instanceId),
      };
    }
    return result;
  }

  // ── Existing — unassign ───────────────────────────────────────────────────

  /** Removes an assignment, attaching a TroncChangeImpact (D11) when it freed a TRONC/BASE node. */
  async unassign(instanceId: string, assignmentId: string): Promise<{ impact?: TroncChangeImpact }> {
    await this.checkEventLock(instanceId);

    const assignment = await this.assignmentRepository.findOne({
      where: { id: assignmentId },
      relations: ['figureInstance', 'figureInstance.segment', 'instanceNode'],
    });

    if (!assignment) {
      throw new NotFoundException(`Assignment with ID ${assignmentId} not found`);
    }

    if (assignment.figureInstance.id !== instanceId) {
      throw new NotFoundException(`Assignment ${assignmentId} does not belong to instance ${instanceId}`);
    }

    const touchesTronc = areaForZone(assignment.instanceNode.zone as FigureZone) === AssignmentArea.TRONC;
    await this.assignmentRepository.remove(assignment);

    if (touchesTronc) {
      return { impact: await this.computeTroncChangeImpact(assignment.figureInstance.segment.id, instanceId) };
    }
    return {};
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

    // Group every placement (moving instance + target segment) by person, so a person
    // with more than one row on either side is no longer collapsed to an arbitrary one.
    const targetPersonIds = new Set(targetAssignments.map((a) => a.person.id));
    const placementsByPersonId = new Map<string, MoveConflictPlacement[]>();
    for (const a of [...movingAssignments, ...targetAssignments]) {
      // A conflict needs the person on both sides of the move.
      if (!targetPersonIds.has(a.person.id)) continue;
      const zone = a.instanceNode.zone as FigureZone;
      const placement: MoveConflictPlacement = {
        assignmentId: a.id,
        zone,
        area: areaForZone(zone) as AssignmentArea,
      };
      const existing = placementsByPersonId.get(a.person.id);
      if (existing) existing.push(placement);
      else placementsByPersonId.set(a.person.id, [placement]);
    }

    const areaRank: Record<string, number> = {
      [AssignmentArea.TRONC]: 0,
      [AssignmentArea.PINYA]: 1,
      [AssignmentArea.DIRECTION]: 2,
    };

    const conflicts: SegmentMoveConflict[] = [];
    for (const [personId, placements] of placementsByPersonId) {
      // Only rows where the person is on both sides make a real overlap. The moving
      // instance always contributes ≥1 (it produced the personId via targetPersonIds),
      // but a target-only person never enters this map, so ≥2 placements here is implied.
      if (placements.length < 2) continue;
      placements.sort((x, y) => (areaRank[x.area] ?? 99) - (areaRank[y.area] ?? 99));
      const troncCount = placements.filter((p) => p.area === AssignmentArea.TRONC).length;
      const kind =
        troncCount >= 2
          ? SegmentConflictKind.TRONC_TRONC
          : troncCount === 1
            ? SegmentConflictKind.TRONC_PINYA
            : SegmentConflictKind.PINYA_PINYA;
      conflicts.push({ personId, placements, kind });
    }
    return conflicts;
  }

  // ── Segment conflicts — canonical source (D13) ─────────────────────────────

  /**
   * Canonical "what conflicts does this segment have" query (D13): every OTHER caller
   * (summary, projection, findAllByEvent, available-persons) reads through this, never
   * reimplementing the classification.
   */
  async getSegmentConflicts(segmentId: string): Promise<SegmentConflictsResponse> {
    const assignments = await this.assignmentRepository.find({
      where: { segment: { id: segmentId } },
      relations: ['instanceNode', 'person', 'figureInstance', 'figureInstance.figureTemplate'],
    });

    const conflicts = this.classifySegmentConflicts(assignments);
    return { data: conflicts, meta: this.computeSegmentPeopleCounters(assignments, conflicts) };
  }

  /**
   * Groups an already-loaded set of assignments (one segment's worth) by person and
   * classifies each >1-placement group. Callers that already have their assignments
   * batched (getEventAssignmentSummary, projection) reuse this instead of re-querying
   * through getSegmentConflicts — same classification, no extra round trip (D13).
   */
  private classifySegmentConflicts(assignments: NodeAssignment[]): SegmentConflict[] {
    const areaRank: Record<string, number> = {
      [AssignmentArea.TRONC]: 0,
      [AssignmentArea.PINYA]: 1,
      [AssignmentArea.DIRECTION]: 2,
    };

    const toPlacement = (a: NodeAssignment): ConflictPlacement => {
      const zone = a.instanceNode.zone as FigureZone;
      return {
        assignmentId: a.id,
        figureInstanceId: a.figureInstance.id,
        figureName: a.figureInstance.figureTemplate?.name ?? 'Sense plantilla',
        nodeId: a.instanceNode.id,
        nodeLabel: a.instanceNode.label ?? null,
        zone,
        area: areaForZone(zone) as AssignmentArea,
        z: a.instanceNode.z ?? null,
        renglaPosition: a.instanceNode.renglaPosition ?? null,
        cordon: a.instanceNode.renglaPosition ?? null,
      };
    };

    const groupsByPersonId = new Map<string, { alias: string; placements: ConflictPlacement[] }>();
    for (const a of assignments) {
      const existing = groupsByPersonId.get(a.person.id);
      const placement = toPlacement(a);
      if (existing) existing.placements.push(placement);
      else groupsByPersonId.set(a.person.id, { alias: a.person.alias, placements: [placement] });
    }

    const conflicts: SegmentConflict[] = [];
    for (const [personId, { alias, placements }] of groupsByPersonId) {
      if (placements.length < 2) continue;

      placements.sort((x, y) => {
        const rankDiff = (areaRank[x.area] ?? 99) - (areaRank[y.area] ?? 99);
        if (rankDiff !== 0) return rankDiff;
        return (x.renglaPosition ?? Infinity) - (y.renglaPosition ?? Infinity);
      });

      const pinyaPlacements = placements.filter((p) => p.area === AssignmentArea.PINYA);
      // §4.1 precedence rule lives in @muixer/shared so participation classifies identically (D13).
      const kind = classifyPlacementKind(placements.map((p) => p.area));

      // suggestedRemovalAssignmentIds (§Notes de disseny): never a tronc placement.
      // PINYA_PINYA keeps the interior one (lowest renglaPosition, fallback z).
      let suggestedRemovalAssignmentIds: string[];
      if (kind === SegmentConflictKind.PINYA_PINYA) {
        const byInterior = [...pinyaPlacements].sort(
          (x, y) => (x.renglaPosition ?? x.z ?? Infinity) - (y.renglaPosition ?? y.z ?? Infinity),
        );
        suggestedRemovalAssignmentIds = byInterior.slice(1).map((p) => p.assignmentId);
      } else {
        suggestedRemovalAssignmentIds = pinyaPlacements.map((p) => p.assignmentId);
      }

      conflicts.push({ personId, personAlias: alias, placements, kind, suggestedRemovalAssignmentIds });
    }

    const kindOrder = [
      SegmentConflictKind.TRONC_TRONC,
      SegmentConflictKind.TRONC_PINYA,
      SegmentConflictKind.PINYA_PINYA,
    ];
    conflicts.sort((a, b) => kindOrder.indexOf(a.kind) - kindOrder.indexOf(b.kind));

    return conflicts;
  }

  private computeSegmentPeopleCounters(
    assignments: NodeAssignment[],
    conflicts: SegmentConflict[],
  ): SegmentPeopleCounters {
    const distinctPersonIds = new Set(assignments.map((a) => a.person.id));
    const troncPersonIds = new Set<string>();
    const pinyaPersonIds = new Set<string>();
    for (const a of assignments) {
      const area = areaForZone(a.instanceNode.zone as FigureZone);
      if (area === AssignmentArea.TRONC) troncPersonIds.add(a.person.id);
      if (area === AssignmentArea.PINYA) pinyaPersonIds.add(a.person.id);
    }

    const conflictsByKind: Record<SegmentConflictKind, number> = {
      [SegmentConflictKind.TRONC_TRONC]: 0,
      [SegmentConflictKind.TRONC_PINYA]: 0,
      [SegmentConflictKind.PINYA_PINYA]: 0,
    };
    for (const c of conflicts) conflictsByKind[c.kind]++;

    return {
      assignmentCount: assignments.length,
      distinctPersonCount: distinctPersonIds.size,
      tronc: { distinctPersonCount: troncPersonIds.size },
      pinya: { distinctPersonCount: pinyaPersonIds.size },
      conflictPersonCount: conflicts.length,
      conflictsByKind,
    };
  }

  async resolveSegmentMoveConflicts(
    instanceId: string,
    targetSegmentId: string,
    personIds: string[],
    resolution: SegmentMoveConflictResolution,
    manager: EntityManager,
  ): Promise<void> {
    if (personIds.length === 0) return;

    // KEEP_BOTH (Fase 5 default, D3): duplicates are legal now — leave both sides untouched.
    // Explicit branch on purpose: falling through to the old `else` would silently delete the
    // target segment's placements, the opposite of what KEEP_BOTH means.
    if (resolution === SegmentMoveConflictResolution.KEEP_BOTH) return;

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
      // B3: count instead of hydrating full InstanceNode rows (geometry unused, only .length was read).
      .loadRelationCountAndMap('fi.instanceNodeCount', 'fi.instanceNodes')
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
        totalNodes: (instance as FigureInstance & { instanceNodeCount?: number }).instanceNodeCount ?? 0,
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

    if (segments.length === 0) {
      return { segments: [] };
    }

    const segmentIds = segments.map((s) => s.id);

    // B3: one batched query for the whole event instead of one per segment
    // (was N+1), and figureTemplate.nodes/instanceNodes/assignments are fetched
    // as separate flat queries instead of leftJoinAndSelect-ed together, which
    // previously caused a cartesian row explosion (nodes × instanceNodes × assignments).
    const instances = await this.figureInstanceRepository.find({
      where: { segment: { id: In(segmentIds) } },
      relations: ['figureTemplate', 'segment'],
    });

    const snapshottedIds = instances.filter((fi) => fi.snapshotted).map((fi) => fi.id);
    const templateIds = [
      ...new Set(
        instances
          .filter((fi) => !fi.snapshotted && fi.figureTemplate)
          .map((fi) => (fi.figureTemplate as FigureTemplate).id),
      ),
    ];

    const [instanceNodes, templateNodes, assignments] = await Promise.all([
      snapshottedIds.length
        ? this.instanceNodeRepository.find({
            where: { figureInstance: { id: In(snapshottedIds) } },
            relations: ['figureInstance'],
          })
        : Promise.resolve([] as InstanceNode[]),
      templateIds.length
        ? this.figureNodeRepository.find({
            where: { template: { id: In(templateIds) } },
            relations: ['template'],
          })
        : Promise.resolve([] as FigureNode[]),
      instances.length
        ? this.assignmentRepository.find({
            where: { segment: { id: In(segmentIds) } },
            relations: ['instanceNode', 'person', 'figureInstance'],
          })
        : Promise.resolve([] as NodeAssignment[]),
    ]);

    const instanceNodesByInstance = new Map<string, InstanceNode[]>();
    for (const n of instanceNodes) {
      const arr = instanceNodesByInstance.get(n.figureInstance.id);
      if (arr) arr.push(n);
      else instanceNodesByInstance.set(n.figureInstance.id, [n]);
    }

    const templateNodesByTemplate = new Map<string, FigureNode[]>();
    for (const n of templateNodes) {
      const arr = templateNodesByTemplate.get(n.template.id);
      if (arr) arr.push(n);
      else templateNodesByTemplate.set(n.template.id, [n]);
    }

    const assignmentsByInstance = new Map<string, NodeAssignment[]>();
    for (const a of assignments) {
      const arr = assignmentsByInstance.get(a.figureInstance.id);
      if (arr) arr.push(a);
      else assignmentsByInstance.set(a.figureInstance.id, [a]);
    }

    const instancesBySegment = new Map<string, FigureInstance[]>();
    const segmentIdByInstanceId = new Map<string, string>();
    for (const fi of instances) {
      const arr = instancesBySegment.get(fi.segment.id);
      if (arr) arr.push(fi);
      else instancesBySegment.set(fi.segment.id, [fi]);
      segmentIdByInstanceId.set(fi.id, fi.segment.id);
    }

    // D13: classify conflicts per segment from the assignments already batched above
    // (no extra query) instead of calling getSegmentConflicts per segment (would
    // reintroduce the N+1 this method was optimized away from).
    const assignmentsBySegment = new Map<string, NodeAssignment[]>();
    for (const a of assignments) {
      const segmentId = segmentIdByInstanceId.get(a.figureInstance.id);
      if (!segmentId) continue;
      const arr = assignmentsBySegment.get(segmentId);
      if (arr) arr.push(a);
      else assignmentsBySegment.set(segmentId, [a]);
    }

    const result: EventSegmentSummary[] = segments.map((segment) => {
      const segmentAssignments = assignmentsBySegment.get(segment.id) ?? [];
      const segmentConflicts = this.classifySegmentConflicts(segmentAssignments);
      const conflictAssignmentIdsByInstance = new Map<string, Set<string>>();
      for (const conflict of segmentConflicts) {
        for (const placement of conflict.placements) {
          const set = conflictAssignmentIdsByInstance.get(placement.figureInstanceId) ?? new Set<string>();
          set.add(placement.assignmentId);
          conflictAssignmentIdsByInstance.set(placement.figureInstanceId, set);
        }
      }

      const segmentInstances = instancesBySegment.get(segment.id) ?? [];
      const figures: EventFigureSummary[] = segmentInstances.map((fi) => {
        const nodes = fi.snapshotted
          ? (instanceNodesByInstance.get(fi.id) ?? [])
          : (templateNodesByTemplate.get(fi.figureTemplate?.id ?? '') ?? []);
        const figureAssignments = assignmentsByInstance.get(fi.id) ?? [];
        const conflictAssignmentIds = conflictAssignmentIdsByInstance.get(fi.id);
        return {
          instanceId: fi.id,
          figureName: fi.figureTemplate?.name ?? 'Sense plantilla',
          snapshotted: fi.snapshotted,
          ...this.computeInstanceAreaSummary(fi, nodes, figureAssignments, conflictAssignmentIds),
        };
      });

      return {
        segmentId: segment.id,
        segmentName: segment.name ?? '',
        sortOrder: segment.sortOrder,
        figures,
        conflicts: this.computeSegmentPeopleCounters(segmentAssignments, segmentConflicts),
      };
    });

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
  private computeInstanceAreaSummary(
    fi: FigureInstance,
    nodes: Array<Pick<InstanceNode | FigureNode, 'zone' | 'positionType' | 'renglaPosition'>>,
    instanceAssignments: NodeAssignment[],
    conflictAssignmentIds?: Set<string>,
  ): {
    pinya: FigureAreaCount;
    tronc: FigureAreaCount;
    total: FigureAreaCount;
    troncBaseAssignments: EventFigureSummary['troncBaseAssignments'];
    distinctPersonCount: number;
    conflictAssignmentCount: number;
  } {
    const figureMode = fi.figureMode ?? FigureMode.COMPLETA;
    const numberOfCordons = fi.numberOfCordons ?? null;
    const cordonsObertsEnabled = fi.cordonsObertsEnabled;
    const cordonsOpts = { figureMode, numberOfCordons, cordonsObertsEnabled };

    const isPinya = (n: { zone: string; positionType: string | null; renglaPosition: number | null }): boolean =>
      n.zone === FigureZone.PINYA && isNodeVisibleByCordons(n, cordonsOpts);
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
    for (const a of instanceAssignments) {
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

    const distinctPersonCount = new Set(instanceAssignments.map((a) => a.person.id)).size;
    const conflictAssignmentCount = conflictAssignmentIds
      ? instanceAssignments.filter((a) => conflictAssignmentIds.has(a.id)).length
      : 0;

    return {
      pinya: { assigned: pinyaAssigned, total: pinyaTotal },
      tronc: { assigned: troncAssigned, total: troncTotal },
      total: {
        assigned: pinyaAssigned + troncAssigned + directionAssigned,
        total: pinyaTotal + troncTotal + directionTotal,
      },
      troncBaseAssignments,
      distinctPersonCount,
      conflictAssignmentCount,
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

      // B4: node/person/segment conflict checks are NOT duplicated here — assign()
      // already performs them (and has the DB-level backstop via toAssignConflictError).
      // Uses assignWithoutLockCheck: the lock was already checked once above.
      try {
        const detail = await this.assignWithoutLockCheck(instanceId, {
          nodeId: targetNode.id,
          personId,
        });
        created.push(detail);
      } catch (err) {
        const reason = this.describeBulkImportError(err);
        if (reason === null) {
          // B2: an unexpected (non-domain) error must not be masked as a conflict.
          this.logger.error(
            `bulkImport: unexpected error assigning node ${targetNode.id} to person ${personId}`,
            err instanceof Error ? err.stack : err,
          );
          throw err;
        }
        conflicts.push({ nodeId: targetNode.id, nodeLabel, personAlias, reason });
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
          await this.assignWithoutLockCheck(instanceId, {
            nodeId: savedClone.id,
            personId,
          });
        } catch (err) {
          const reason = this.describeBulkImportError(err);
          if (reason === null) {
            this.logger.error(
              `bulkImport: unexpected error cloning ad-hoc assignment for node ${savedClone.id}`,
              err instanceof Error ? err.stack : err,
            );
            throw err;
          }
          // B2 fix: propagate the classified reason instead of a hardcoded generic message.
          conflicts.push({
            nodeId: savedClone.id,
            nodeLabel: sourceAdHoc.label,
            personAlias,
            reason,
          });
        }
      }
    }

    const { meta } = await this.getSegmentConflicts(targetInstance.segment.id);
    return { created, conflicts, clonedAdHocNodes, conflictsByKind: meta.conflictsByKind };
  }


  // ── Cordons — update numberOfCordons on instance ────────────────────────────

  async updateCordons(
    instanceId: string,
    dto: { numberOfCordons?: number | null; cordonsObertsEnabled?: boolean },
  ): Promise<{ numberOfCordons: number | null; cordonsObertsEnabled: boolean; removedAssignments: number }> {
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

    let removedAssignments = 0;
    if (instance.numberOfCordons !== null) {
      removedAssignments += await this.removeAssignmentsBeyondCordons(instanceId, instance.numberOfCordons);
    }
    if (disablingCordonsOberts) {
      removedAssignments += await this.removeCordoObertAssignments(instanceId);
    }

    return {
      numberOfCordons: instance.numberOfCordons,
      cordonsObertsEnabled: instance.cordonsObertsEnabled,
      removedAssignments,
    };
  }

  /**
   * Read-only counterpart to removeAssignmentsBeyondCordons(): how many assignments a reduction
   * to `numberOfCordons` WOULD remove, without removing them — lets the caller confirm before
   * committing a destructive reduction instead of finding out after the fact.
   */
  async previewCordonsReduction(instanceId: string, numberOfCordons: number): Promise<number> {
    const hiddenNodeIds = await this.hiddenNodeIdsBeyondCordons(instanceId, numberOfCordons);
    if (hiddenNodeIds.length === 0) return 0;

    return this.assignmentRepository.count({
      where: { figureInstance: { id: instanceId }, instanceNode: { id: In(hiddenNodeIds) } },
    });
  }

  private async hiddenNodeIdsBeyondCordons(instanceId: string, numberOfCordons: number): Promise<string[]> {
    const nodes = await this.instanceNodeRepository.find({
      where: { figureInstance: { id: instanceId } },
    });
    return nodes
      .filter(
        (n) =>
          n.zone === FigureZone.PINYA &&
          n.positionType !== 'cordo-obert' &&
          n.renglaPosition !== null &&
          n.renglaPosition > numberOfCordons,
      )
      .map((n) => n.id);
  }

  /**
   * Deletes assignments on PINYA nodes whose renglaPosition falls beyond
   * numberOfCordons — those nodes become hidden from the assignment UI, so an
   * assignment on one would otherwise silently linger and reappear if cordons
   * are later increased again. cordo-obert nodes are exempt: they stay
   * assignable regardless of numberOfCordons. Returns how many were removed,
   * so callers can tell the caller-facing "reducing cordons unassigned N
   * people" from a no-op reduction.
   */
  private async removeAssignmentsBeyondCordons(instanceId: string, numberOfCordons: number): Promise<number> {
    const hiddenNodeIds = await this.hiddenNodeIdsBeyondCordons(instanceId, numberOfCordons);
    if (hiddenNodeIds.length === 0) return 0;

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId }, instanceNode: { id: In(hiddenNodeIds) } },
      relations: ['instanceNode'],
    });
    if (assignments.length === 0) return 0;

    await this.assignmentRepository.remove(assignments);
    return assignments.length;
  }

  /**
   * Deletes assignments on cordo-obert nodes — called when cordonsObertsEnabled
   * is turned off, since those nodes become hidden from the assignment UI.
   */
  private async removeCordoObertAssignments(instanceId: string): Promise<number> {
    const nodes = await this.instanceNodeRepository.find({
      where: { figureInstance: { id: instanceId } },
    });
    const cordoObertNodeIds = nodes.filter((n) => n.positionType === 'cordo-obert').map((n) => n.id);
    if (cordoObertNodeIds.length === 0) return 0;

    const assignments = await this.assignmentRepository.find({
      where: { figureInstance: { id: instanceId }, instanceNode: { id: In(cordoObertNodeIds) } },
      relations: ['instanceNode'],
    });
    if (assignments.length === 0) return 0;

    await this.assignmentRepository.remove(assignments);
    return assignments.length;
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
    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${instanceId} not found`);
    }
    if (!instance.segment) {
      // Data-integrity gap (orphaned instance): the lock can't be evaluated without
      // a segment/event, but this must not be a silent no-op — B1.
      this.logger.warn(
        `checkEventLock: instance ${instanceId} has no segment; skipping lock check`,
      );
      return;
    }

    const event = instance.segment.event as Event;
    if (!event) {
      this.logger.warn(
        `checkEventLock: segment ${instance.segment.id} has no event; skipping lock check`,
      );
      return;
    }

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
   * assign()/swap() into the same ConflictException the NODE_OCCUPIED pre-check
   * throws, instead of letting it surface as a raw 500 (BUG-18). Since Fase 5
   * dropped the person-scoped uniques, UQ_node_assignments_instance_node is the
   * only constraint that can still fire here. Any other error is rethrown as-is.
   */
  private toAssignConflictError(err: unknown): Error {
    const pgErr = err as { code?: string };
    if (pgErr?.code !== '23505') return err as Error;
    return new AssignConflictException('Node is already occupied in this figure instance', 'NODE_OCCUPIED');
  }

  /**
   * Classifies an error caught from an assign() call inside bulkImport (B2/B4).
   * Domain errors (conflict/not-found/bad-request) become a specific, user-facing
   * `conflicts[]` reason so bulkImport can keep going. Anything else (infra
   * failures, timeouts, unexpected exceptions) returns null so the caller
   * rethrows instead of silently disguising it as a conflict.
   */
  private describeBulkImportError(err: unknown): string | null {
    if (err instanceof AssignConflictException) {
      return 'Node already occupied in target instance';
    }
    if (err instanceof BadRequestException || err instanceof NotFoundException) {
      return err.message;
    }
    return null;
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
