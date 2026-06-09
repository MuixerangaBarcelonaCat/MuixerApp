import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InstanceRef } from '@muixer/shared';
import { FigureInstance } from './entities/figure-instance.entity';
import { EventSegment } from './entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { UpdateInstanceDto } from './dto/update-instance.dto';
import { ReorderInstancesDto } from './dto/reorder-instances.dto';

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
    const dtoIds = new Set(dto.instanceIds);

    const invalid = dto.instanceIds.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Instance IDs not found in segment: ${invalid.join(', ')}`,
      );
    }

    const missing = existing.filter((i) => !dtoIds.has(i.id)).map((i) => i.id);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Reorder must include all instances. Missing: ${missing.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < dto.instanceIds.length; i++) {
        await manager.update(FigureInstance, { id: dto.instanceIds[i] }, { sortOrder: i });
      }
    });
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

    // H1 fix: query the actual assignment count instead of hardcoding 0.
    // Uses DataSource.getRepository to avoid adding NodeAssignment to module's
    // forFeature (it is already registered via NodeAssignmentModule).
    const assignedCount = await this.dataSource
      .getRepository(NodeAssignment)
      .count({ where: { figureInstance: { id: instance.id } } });

    return {
      id: instance.id,
      label: instance.label,
      sortOrder: instance.sortOrder,
      snapshotted: instance.snapshotted,
      sourceVariantOrder: instance.sourceVariantOrder,
      assignedCount,
      numberOfCordons: instance.numberOfCordons,
      openCordons: instance.openCordons,
      figureTemplate: instance.figureTemplate
        ? { id: instance.figureTemplate.id, name: instance.figureTemplate.name }
        : null,
      compositionTemplate: instance.compositionTemplate
        ? { id: instance.compositionTemplate.id, name: instance.compositionTemplate.name }
        : null,
    };
  }
}
