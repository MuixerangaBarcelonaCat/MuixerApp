import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { FigureInstance } from './entities/figure-instance.entity';
import { EventSegment } from './entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Composition } from '../composition/entities/composition.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { UpdateInstanceDto } from './dto/update-instance.dto';
import { ReorderInstancesDto } from './dto/reorder-instances.dto';
import { UpdateSegmentDistributionDto } from './dto/update-segment-distribution.dto';
import { EventSegmentService, InstanceRef, SegmentWithInstances } from './event-segment.service';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';

export interface DistributionNodeItem {
  id: string;
  label: string;
  zone: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  color: string | null;
  shape: string;
  renglaId: string | null;
  renglaPosition: number | null;
  positionType: string | null;
}

export interface DistributionAssignment {
  figureNodeId: string;
  personAlias: string;
}

export interface DistributionItem {
  instanceId: string;
  label: string | null;
  figureMode: string;
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
  assignments: DistributionAssignment[];
  figureTemplate: { id: string; name: string; nodes: DistributionNodeItem[] };
  troncGridCols: number;
  troncGridRows: number;
  projectionX: number | null;
  projectionY: number | null;
  projectionAngle: number | null;
  troncPanelX: number | null;
  troncPanelY: number | null;
  troncPanelWidth: number | null;
  troncPanelHeight: number | null;
}

export interface SegmentDistributionData {
  segment: { id: string; name: string | null };
  items: DistributionItem[];
}
import { FigureMode, FigureZone, SegmentMoveConflictResolution, SegmentConflictKind } from '@muixer/shared';

export interface MoveInstanceResult {
  sourceSegment: SegmentWithInstances;
  targetSegment: SegmentWithInstances;
}

@Injectable()
export class FigureInstanceService {
  constructor(
    @InjectRepository(FigureInstance)
    private readonly instanceRepository: Repository<FigureInstance>,
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(FigureTemplate)
    private readonly figureTemplateRepository: Repository<FigureTemplate>,
    @InjectRepository(Composition)
    private readonly compositionRepository: Repository<Composition>,
    private readonly segmentService: EventSegmentService,
    private readonly nodeAssignmentService: NodeAssignmentService,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    eventId: string,
    segmentId: string,
    dto: CreateInstanceDto,
  ): Promise<InstanceRef> {
    if (!dto.figureTemplateId) {
      throw new BadRequestException('figureTemplateId must be provided');
    }

    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);
    await this.nodeAssignmentService.checkEventLockByEventId(eventId);

    const figureTemplate = await this.figureTemplateRepository.findOne({
      where: { id: dto.figureTemplateId },
    });
    if (!figureTemplate) {
      throw new NotFoundException(`FigureTemplate with ID ${dto.figureTemplateId} not found`);
    }

    const maxOrder = await this.instanceRepository
      .createQueryBuilder('instance')
      .select('MAX(instance.sortOrder)', 'max')
      .where('instance.segment = :segmentId', { segmentId })
      .getRawOne<{ max: number | null }>();

    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const instance = this.instanceRepository.create({
      segment,
      figureTemplate,
      label: dto.label ?? null,
      sortOrder,
    });

    const saved = await this.instanceRepository.save(instance);
    return this.findOneById(saved.id);
  }

  async update(
    eventId: string,
    segmentId: string,
    instanceId: string,
    dto: UpdateInstanceDto,
  ): Promise<InstanceRef> {
    const instance = await this.assertInstanceBelongsToSegment(eventId, segmentId, instanceId);

    if (dto.label !== undefined) instance.label = dto.label ?? null;
    if (dto.sortOrder !== undefined) instance.sortOrder = dto.sortOrder;
    if (dto.figureMode !== undefined) {
      await this.nodeAssignmentService.checkEventLock(instanceId);
      instance.figureMode = dto.figureMode;
    }

    if (dto.figureMode === FigureMode.REMAT || dto.figureMode === FigureMode.NETA) {
      // Deletion + save must commit or roll back together: otherwise a failed save after
      // the delete would leave assignments gone but figureMode unchanged (see BUG-13).
      await this.dataSource.transaction(async (manager) => {
        if (dto.figureMode === FigureMode.REMAT) {
          await this.deletePinyaAssignments(instanceId, manager);
        } else {
          await this.deletePinyaOnlyAssignments(instanceId, manager);
        }
        await manager.save(FigureInstance, instance);
      });
    } else {
      await this.instanceRepository.save(instance);
    }

    return this.findOneById(instance.id);
  }

  async remove(eventId: string, segmentId: string, instanceId: string): Promise<void> {
    const instance = await this.assertInstanceBelongsToSegment(eventId, segmentId, instanceId);
    await this.nodeAssignmentService.checkEventLock(instanceId);
    await this.instanceRepository.remove(instance);
  }

  async reorder(
    eventId: string,
    segmentId: string,
    dto: ReorderInstancesDto,
  ): Promise<void> {
    await this.assertSegmentBelongsToEvent(eventId, segmentId);
    await this.nodeAssignmentService.checkEventLockByEventId(eventId);

    const existing = await this.instanceRepository.find({
      where: { segment: { id: segmentId } },
      select: ['id'],
    });

    const existingIds = new Set(existing.map((i) => i.id));
    const invalid = dto.instanceIds.filter((id) => !existingIds.has(id));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Instance IDs not found in segment: ${invalid.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < dto.instanceIds.length; i++) {
        await manager.update(FigureInstance, { id: dto.instanceIds[i] }, { sortOrder: i });
      }
    });
  }

  async copy(
    eventId: string,
    segmentId: string,
    instanceId: string,
    targetSegmentId: string,
  ): Promise<InstanceRef> {
    const sourceInstance = await this.instanceRepository.findOne({
      where: { id: instanceId, segment: { id: segmentId } },
      relations: ['figureTemplate'],
    });
    if (!sourceInstance) {
      throw new NotFoundException(`Instance with ID ${instanceId} not found in segment ${segmentId}`);
    }

    await this.assertSegmentBelongsToEvent(eventId, segmentId);
    const targetSegment = await this.assertSegmentBelongsToEvent(eventId, targetSegmentId);
    await this.nodeAssignmentService.checkEventLockByEventId(eventId);

    const maxOrder = await this.instanceRepository
      .createQueryBuilder('instance')
      .select('MAX(instance.sortOrder)', 'max')
      .where('instance.segment = :segmentId', { segmentId: targetSegmentId })
      .getRawOne<{ max: number | null }>();

    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const newInstance = this.instanceRepository.create({
      segment: targetSegment,
      figureTemplate: sourceInstance.figureTemplate ?? null,
      label: sourceInstance.label,
      sortOrder,
    });

    const saved = await this.instanceRepository.save(newInstance);
    return this.findOneById(saved.id);
  }

  async move(
    eventId: string,
    segmentId: string,
    instanceId: string,
    targetSegmentId: string,
    targetIndex?: number,
    resolution?: SegmentMoveConflictResolution,
  ): Promise<MoveInstanceResult> {
    if (segmentId === targetSegmentId) {
      throw new BadRequestException('targetSegmentId must be different from the current segment');
    }

    await this.assertInstanceBelongsToSegment(eventId, segmentId, instanceId);
    const targetSegment = await this.assertSegmentBelongsToEvent(eventId, targetSegmentId);

    await this.nodeAssignmentService.checkEventLock(instanceId);

    const conflicts = await this.nodeAssignmentService.getSegmentMoveConflicts(instanceId, targetSegmentId);

    if (conflicts.length > 0 && !resolution) {
      // `tronc` = persons with any tronc-area (TRONC/BASE) placement, i.e. every kind
      // except PINYA_PINYA. Equivalent to the old `isTronc` flag; keeps the HTTP body
      // ({ code, total, tronc }) the dashboard consumes unchanged (Fase 0).
      throw new ConflictException({
        code: 'SEGMENT_MOVE_CONFLICT',
        total: conflicts.length,
        tronc: conflicts.filter((c) => c.kind !== SegmentConflictKind.PINYA_PINYA).length,
      });
    }

    const targetInstances = await this.instanceRepository.find({
      where: { segment: { id: targetSegmentId } },
      select: ['id'],
      order: { sortOrder: 'ASC' },
    });
    const orderedIds = targetInstances.map((i) => i.id);
    const insertAt = Math.min(Math.max(targetIndex ?? orderedIds.length, 0), orderedIds.length);
    orderedIds.splice(insertAt, 0, instanceId);

    await this.dataSource.transaction(async (manager) => {
      if (conflicts.length > 0 && resolution) {
        const personIds = conflicts.map((c) => c.personId);
        await this.nodeAssignmentService.resolveSegmentMoveConflicts(
          instanceId,
          targetSegmentId,
          personIds,
          resolution,
          manager,
        );
      }

      for (let i = 0; i < orderedIds.length; i++) {
        if (orderedIds[i] === instanceId) {
          await manager.update(
            FigureInstance,
            { id: instanceId },
            { segment: { id: targetSegment.id }, sortOrder: i } as QueryDeepPartialEntity<FigureInstance>,
          );
        } else {
          await manager.update(FigureInstance, { id: orderedIds[i] }, { sortOrder: i });
        }
      }
      await manager.update(
        NodeAssignment,
        { figureInstance: { id: instanceId } },
        { segment: { id: targetSegment.id } } as QueryDeepPartialEntity<NodeAssignment>,
      );
    });

    return {
      sourceSegment: await this.segmentService.getOne(segmentId),
      targetSegment: await this.segmentService.getOne(targetSegmentId),
    };
  }

  async saveDistribution(
    eventId: string,
    segmentId: string,
    dto: UpdateSegmentDistributionDto,
  ): Promise<void> {
    await this.assertSegmentBelongsToEvent(eventId, segmentId);

    const existing = await this.instanceRepository.find({
      where: { segment: { id: segmentId } },
      select: ['id'],
    });
    const existingIds = new Set(existing.map((i) => i.id));
    const invalid = dto.items.filter((item) => !existingIds.has(item.instanceId));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Instance IDs not found in segment: ${invalid.map((i) => i.instanceId).join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.items) {
        await manager.update(FigureInstance, { id: item.instanceId }, {
          projectionX: item.x,
          projectionY: item.y,
          projectionAngle: item.angle,
          troncPanelX: item.troncPanelX ?? null,
          troncPanelY: item.troncPanelY ?? null,
          troncPanelWidth: item.troncPanelWidth ?? null,
          troncPanelHeight: item.troncPanelHeight ?? null,
        });
      }
    });
  }

  async clearDistribution(eventId: string, segmentId: string): Promise<void> {
    await this.assertSegmentBelongsToEvent(eventId, segmentId);

    await this.dataSource.query(
      `UPDATE figure_instances
       SET "projectionX" = NULL, "projectionY" = NULL, "projectionAngle" = NULL,
           "troncPanelX" = NULL, "troncPanelY" = NULL,
           "troncPanelWidth" = NULL, "troncPanelHeight" = NULL
       WHERE "segmentId" = $1`,
      [segmentId],
    );
  }

  async getDistribution(eventId: string, segmentId: string): Promise<SegmentDistributionData> {
    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);

    const instances = await this.instanceRepository.find({
      where: { segment: { id: segmentId } },
      relations: ['figureTemplate', 'figureTemplate.nodes'],
      order: { sortOrder: 'ASC' },
    });

    // `sortOrder` isn't guaranteed unique across instances (duplicates exist in
    // practice), so ties must be broken deterministically here — otherwise
    // Postgres can return a different row order on each call.
    const figureInstances = instances
      .filter((inst) => inst.figureTemplate !== null)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
    const instanceIds = figureInstances.map((inst) => inst.id);

    type AssignmentRow = { instanceId: string; figureNodeId: string; personAlias: string };
    let allAssignmentRows: AssignmentRow[] = [];
    if (instanceIds.length > 0) {
      allAssignmentRows = await this.dataSource.query(
        `SELECT na."figureInstanceId" AS "instanceId", inode."sourceNodeId" AS "figureNodeId", p.alias AS "personAlias"
         FROM node_assignments na
         JOIN instance_nodes inode ON na."instanceNodeId" = inode.id
         JOIN persons p ON na."personId" = p.id
         WHERE na."figureInstanceId" = ANY($1)`,
        [instanceIds],
      );
    }

    const assignmentsByInstance = new Map<string, DistributionAssignment[]>();
    for (const row of allAssignmentRows) {
      const list = assignmentsByInstance.get(row.instanceId) ?? [];
      list.push({ figureNodeId: row.figureNodeId, personAlias: row.personAlias });
      assignmentsByInstance.set(row.instanceId, list);
    }

    const CANVAS_ZONES = new Set([FigureZone.PINYA, FigureZone.BASE]);

    const items: DistributionItem[] = figureInstances.map((inst) => {
      const allNodes = inst.figureTemplate!.nodes ?? [];

      const troncNodes = allNodes.filter((n) => n.zone === FigureZone.TRONC);
      const troncGridCols = troncNodes.reduce((max, n) => Math.max(max, n.x + n.width), 0);
      const distinctZLevels = new Set(troncNodes.map((n) => n.z)).size;
      const hasFigureDirection = allNodes.some((n) => n.zone === FigureZone.FIGURE_DIRECTION);
      const hasXicallaDirection = allNodes.some((n) => n.zone === FigureZone.XICALLA_DIRECTION);
      const troncGridRows = distinctZLevels + (hasFigureDirection ? 1 : 0) + (hasXicallaDirection ? 1 : 0);

      return {
        instanceId: inst.id,
        label: inst.label,
        figureMode: inst.figureMode ?? FigureMode.COMPLETA,
        numberOfCordons: inst.numberOfCordons ?? null,
        cordonsObertsEnabled: inst.cordonsObertsEnabled,
        assignments: assignmentsByInstance.get(inst.id) ?? [],
        figureTemplate: {
          id: inst.figureTemplate!.id,
          name: inst.figureTemplate!.name,
          nodes: allNodes
            .filter((n) => CANVAS_ZONES.has(n.zone as FigureZone))
            .map((n) => ({
              id: n.id,
              label: n.label,
              zone: n.zone,
              x: n.x,
              y: n.y,
              width: n.width,
              height: n.height,
              rotation: n.rotation,
              color: n.color,
              shape: n.shape,
              renglaId: n.renglaId,
              renglaPosition: n.renglaPosition,
              positionType: n.positionType,
            })),
        },
        troncGridCols,
        troncGridRows,
        projectionX: inst.projectionX,
        projectionY: inst.projectionY,
        projectionAngle: inst.projectionAngle,
        troncPanelX: inst.troncPanelX,
        troncPanelY: inst.troncPanelY,
        troncPanelWidth: inst.troncPanelWidth,
        troncPanelHeight: inst.troncPanelHeight,
      };
    });

    return { segment: { id: segment.id, name: segment.name }, items };
  }

  private async assertSegmentBelongsToEvent(
    eventId: string,
    segmentId: string,
  ): Promise<EventSegment> {
    const segment = await this.segmentRepository.findOne({
      where: { id: segmentId, event: { id: eventId } },
    });
    if (!segment) {
      throw new NotFoundException(
        `Segment with ID ${segmentId} not found in event ${eventId}`,
      );
    }
    return segment;
  }

  private async assertInstanceBelongsToSegment(
    eventId: string,
    segmentId: string,
    instanceId: string,
  ): Promise<FigureInstance> {
    await this.assertSegmentBelongsToEvent(eventId, segmentId);

    const instance = await this.instanceRepository.findOne({
      where: { id: instanceId, segment: { id: segmentId } },
    });
    if (!instance) {
      throw new NotFoundException(
        `Instance with ID ${instanceId} not found in segment ${segmentId}`,
      );
    }
    return instance;
  }

  private async findOneById(id: string): Promise<InstanceRef> {
    const instance = await this.instanceRepository.findOne({
      where: { id },
      relations: ['figureTemplate'],
    });

    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${id} not found`);
    }

    const hasPinyaFigure = !!instance.figureTemplate && instance.figureMode !== FigureMode.REMAT && instance.figureMode !== FigureMode.NETA;

    const [countResult, pinyaResult, pinyaAssignedResult, cordonsResult] = await Promise.all([
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM node_assignments WHERE "figureInstanceId" = $1`,
        [id],
      ),
      instance.figureTemplate
        ? this.dataSource.query(
            `SELECT COUNT(*) as count FROM figure_nodes WHERE zone = 'PINYA' AND "templateId" = $1`,
            [instance.figureTemplate.id],
          )
        : Promise.resolve([{ count: '0' }]),
      this.dataSource.query(
        `SELECT COUNT(*) as count FROM node_assignments na
         JOIN instance_nodes inode ON na."instanceNodeId" = inode.id
         WHERE na."figureInstanceId" = $1 AND inode.zone IN ('PINYA', 'BASE')`,
        [id],
      ),
      hasPinyaFigure && instance.figureTemplate
        ? this.dataSource.query(
            `SELECT COUNT(*) as total FROM rengles WHERE "templateId" = $1`,
            [instance.figureTemplate.id],
          )
        : Promise.resolve([{ total: '0' }]),
    ]);

    const assignedCount = parseInt(countResult[0]?.count ?? '0', 10);
    const hasPinya = parseInt(pinyaResult[0]?.count ?? '0', 10) > 0;
    const pinyaAssignedCount = parseInt(pinyaAssignedResult[0]?.count ?? '0', 10);
    const totalCordons = hasPinyaFigure ? parseInt(cordonsResult[0]?.total ?? '0', 10) : null;

    return {
      id: instance.id,
      label: instance.label,
      sortOrder: instance.sortOrder,
      snapshotted: instance.snapshotted,
      assignedCount,
      pinyaAssignedCount,
      totalCordons,
      numberOfCordons: instance.numberOfCordons ?? null,
      cordonsObertsEnabled: instance.cordonsObertsEnabled,
      figureMode: instance.figureMode ?? FigureMode.COMPLETA,
      figureTemplate: instance.figureTemplate
        ? {
            id: instance.figureTemplate.id,
            name: instance.figureTemplate.name,
            hasPinya,
          }
        : null,
    };
  }

  private async deletePinyaAssignments(instanceId: string, manager: EntityManager): Promise<void> {
    await manager.query(
      `DELETE FROM node_assignments
       WHERE "figureInstanceId" = $1
       AND "instanceNodeId" IN (
         SELECT id FROM instance_nodes WHERE "figureInstanceId" = $1 AND zone IN ('PINYA', 'BASE')
       )`,
      [instanceId],
    );
  }

  private async deletePinyaOnlyAssignments(instanceId: string, manager: EntityManager): Promise<void> {
    await manager.query(
      `DELETE FROM node_assignments
       WHERE "figureInstanceId" = $1
       AND "instanceNodeId" IN (
         SELECT id FROM instance_nodes WHERE "figureInstanceId" = $1 AND zone = 'PINYA'
       )`,
      [instanceId],
    );
  }

  async applyComposition(
    eventId: string,
    segmentId: string,
    compositionId: string,
  ): Promise<SegmentWithInstances> {
    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);
    await this.nodeAssignmentService.checkEventLockByEventId(eventId);

    const composition = await this.compositionRepository.findOne({
      where: { id: compositionId },
      relations: ['entries', 'entries.figureTemplate'],
      order: { entries: { sortOrder: 'ASC' } },
    });
    if (!composition) {
      throw new NotFoundException(`Composition with ID ${compositionId} not found`);
    }

    const maxOrder = await this.instanceRepository
      .createQueryBuilder('instance')
      .select('MAX(instance.sortOrder)', 'max')
      .where('instance.segment = :segmentId', { segmentId })
      .getRawOne<{ max: number | null }>();

    let nextSortOrder = (maxOrder?.max ?? -1) + 1;

    await this.dataSource.transaction(async (manager) => {
      await manager.save(EventSegment, { id: segment.id, name: composition.name });

      for (const entry of composition.entries ?? []) {
        const sortOrder = nextSortOrder++;

        const instance = this.instanceRepository.create({
          segment,
          figureTemplate: entry.figureTemplate,
          label: entry.label,
          figureMode: entry.figureMode,
          numberOfCordons: entry.numberOfCordons,
          cordonsObertsEnabled: entry.cordonsObertsEnabled,
          sortOrder,
          projectionX: entry.offsetX,
          projectionY: entry.offsetY,
          projectionAngle: entry.angle,
          troncPanelX: entry.troncPanelX,
          troncPanelY: entry.troncPanelY,
        });

        await manager.save(FigureInstance, instance);
      }
    });

    return this.segmentService.getOne(segmentId);
  }
}
