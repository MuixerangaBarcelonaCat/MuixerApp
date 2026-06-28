import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { FigureInstance } from './entities/figure-instance.entity';
import { EventSegment } from './entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { UpdateInstanceDto } from './dto/update-instance.dto';
import { ReorderInstancesDto } from './dto/reorder-instances.dto';
import { UpdateSegmentDistributionDto } from './dto/update-segment-distribution.dto';
import { InstanceRef } from './event-segment.service';

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
}

export interface DistributionItem {
  instanceId: string;
  label: string | null;
  figureTemplate: { id: string; name: string; nodes: DistributionNodeItem[] };
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
import { FigureMode, FigureZone } from '@muixer/shared';

@Injectable()
export class FigureInstanceService {
  constructor(
    @InjectRepository(FigureInstance)
    private readonly instanceRepository: Repository<FigureInstance>,
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(FigureTemplate)
    private readonly figureTemplateRepository: Repository<FigureTemplate>,
    @InjectRepository(CompositionTemplate)
    private readonly compositionTemplateRepository: Repository<CompositionTemplate>,
    private readonly dataSource: DataSource,
  ) {}

  async create(
    eventId: string,
    segmentId: string,
    dto: CreateInstanceDto,
  ): Promise<InstanceRef> {
    const hasFigure = !!dto.figureTemplateId;
    const hasComposition = !!dto.compositionTemplateId;

    if (hasFigure === hasComposition) {
      throw new BadRequestException(
        'Exactly one of figureTemplateId or compositionTemplateId must be provided',
      );
    }

    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);

    let figureTemplate: FigureTemplate | null = null;
    let compositionTemplate: CompositionTemplate | null = null;

    if (dto.figureTemplateId) {
      figureTemplate = await this.figureTemplateRepository.findOne({
        where: { id: dto.figureTemplateId },
      });
      if (!figureTemplate) {
        throw new NotFoundException(`FigureTemplate with ID ${dto.figureTemplateId} not found`);
      }
    }

    if (dto.compositionTemplateId) {
      compositionTemplate = await this.compositionTemplateRepository.findOne({
        where: { id: dto.compositionTemplateId },
      });
      if (!compositionTemplate) {
        throw new NotFoundException(`CompositionTemplate with ID ${dto.compositionTemplateId} not found`);
      }
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
      compositionTemplate,
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
      instance.figureMode = dto.figureMode;
      if (dto.figureMode === FigureMode.REMAT) {
        await this.deletePinyaAssignments(instanceId);
      } else if (dto.figureMode === FigureMode.NETA) {
        await this.deletePinyaOnlyAssignments(instanceId);
      }
    }

    await this.instanceRepository.save(instance);
    return this.findOneById(instance.id);
  }

  async remove(eventId: string, segmentId: string, instanceId: string): Promise<void> {
    const instance = await this.assertInstanceBelongsToSegment(eventId, segmentId, instanceId);
    await this.instanceRepository.remove(instance);
  }

  async reorder(
    eventId: string,
    segmentId: string,
    dto: ReorderInstancesDto,
  ): Promise<void> {
    await this.assertSegmentBelongsToEvent(eventId, segmentId);

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
      relations: ['figureTemplate', 'compositionTemplate'],
    });
    if (!sourceInstance) {
      throw new NotFoundException(`Instance with ID ${instanceId} not found in segment ${segmentId}`);
    }

    await this.assertSegmentBelongsToEvent(eventId, segmentId);
    const targetSegment = await this.assertSegmentBelongsToEvent(eventId, targetSegmentId);

    const maxOrder = await this.instanceRepository
      .createQueryBuilder('instance')
      .select('MAX(instance.sortOrder)', 'max')
      .where('instance.segment = :segmentId', { segmentId: targetSegmentId })
      .getRawOne<{ max: number | null }>();

    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const newInstance = this.instanceRepository.create({
      segment: targetSegment,
      figureTemplate: sourceInstance.figureTemplate ?? null,
      compositionTemplate: sourceInstance.compositionTemplate ?? null,
      label: sourceInstance.label,
      sortOrder,
    });

    const saved = await this.instanceRepository.save(newInstance);
    return this.findOneById(saved.id);
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

    const CANVAS_ZONES = new Set([FigureZone.PINYA, FigureZone.BASE]);

    const items: DistributionItem[] = instances
      .filter((inst) => inst.figureTemplate !== null)
      .map((inst) => ({
        instanceId: inst.id,
        label: inst.label,
        figureTemplate: {
          id: inst.figureTemplate!.id,
          name: inst.figureTemplate!.name,
          nodes: (inst.figureTemplate!.nodes ?? [])
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
            })),
        },
        projectionX: inst.projectionX,
        projectionY: inst.projectionY,
        projectionAngle: inst.projectionAngle,
        troncPanelX: inst.troncPanelX,
        troncPanelY: inst.troncPanelY,
        troncPanelWidth: inst.troncPanelWidth,
        troncPanelHeight: inst.troncPanelHeight,
      }));

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
      relations: ['figureTemplate', 'compositionTemplate'],
    });

    if (!instance) {
      throw new NotFoundException(`FigureInstance with ID ${id} not found`);
    }

    const hasPinyaFigure = !!instance.figureTemplate && instance.figureMode !== FigureMode.REMAT && instance.figureMode !== FigureMode.NETA;

    const [countResult, pinyaResult, pinyaAssignedResult, capacityResult, cordonsResult] = await Promise.all([
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
      hasPinyaFigure
        ? instance.snapshotted
          ? this.dataSource.query(
              `SELECT COUNT(*) as capacity
               FROM instance_nodes in_
               LEFT JOIN rengles r ON r.id = in_."renglaId"
               WHERE in_."figureInstanceId" = $1
               AND in_.zone IN ('PINYA', 'BASE')
               AND ($2::int IS NULL OR in_.zone = 'BASE' OR r."sortOrder" < $2::int)`,
              [id, instance.numberOfCordons],
            )
          : this.dataSource.query(
              `SELECT COUNT(*) as capacity
               FROM figure_nodes fn
               LEFT JOIN rengles r ON r.id = fn."renglaId"
               WHERE fn."templateId" = $1
               AND fn.zone IN ('PINYA', 'BASE')
               AND ($2::int IS NULL OR fn.zone = 'BASE' OR r."sortOrder" < $2::int)`,
              [instance.figureTemplate!.id, instance.numberOfCordons],
            )
        : Promise.resolve([{ capacity: '0' }]),
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
    const pinyaCapacity = hasPinyaFigure ? parseInt(capacityResult[0]?.capacity ?? '0', 10) : null;
    const totalCordons = hasPinyaFigure ? parseInt(cordonsResult[0]?.total ?? '0', 10) : null;

    return {
      id: instance.id,
      label: instance.label,
      sortOrder: instance.sortOrder,
      snapshotted: instance.snapshotted,
      assignedCount,
      pinyaAssignedCount,
      pinyaCapacity,
      totalCordons,
      numberOfCordons: instance.numberOfCordons ?? null,
      figureMode: instance.figureMode ?? FigureMode.COMPLETA,
      figureTemplate: instance.figureTemplate
        ? {
            id: instance.figureTemplate.id,
            name: instance.figureTemplate.name,
            hasPinya,
          }
        : null,
      compositionTemplate: instance.compositionTemplate
        ? { id: instance.compositionTemplate.id, name: instance.compositionTemplate.name }
        : null,
    };
  }

  private async deletePinyaAssignments(instanceId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM node_assignments
       WHERE "figureInstanceId" = $1
       AND "instanceNodeId" IN (
         SELECT id FROM instance_nodes WHERE "figureInstanceId" = $1 AND zone IN ('PINYA', 'BASE')
       )`,
      [instanceId],
    );
  }

  private async deletePinyaOnlyAssignments(instanceId: string): Promise<void> {
    await this.dataSource.query(
      `DELETE FROM node_assignments
       WHERE "figureInstanceId" = $1
       AND "instanceNodeId" IN (
         SELECT id FROM instance_nodes WHERE "figureInstanceId" = $1 AND zone = 'PINYA'
       )`,
      [instanceId],
    );
  }
}
