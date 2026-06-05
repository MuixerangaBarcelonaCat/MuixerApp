import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { InstanceRef, SegmentDetail } from '@muixer/shared';
import { EventSegment } from './entities/event-segment.entity';
import { Event } from '../event/event.entity';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { ReorderSegmentsDto } from './dto/reorder-segments.dto';

@Injectable()
export class EventSegmentService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllByEvent(eventId: string): Promise<SegmentDetail[]> {
    await this.assertEventExists(eventId);

    const segments = await this.segmentRepository
      .createQueryBuilder('segment')
      .leftJoinAndSelect('segment.instances', 'instance')
      .leftJoinAndSelect('instance.figureTemplate', 'figureTemplate')
      .leftJoinAndSelect('instance.compositionTemplate', 'compositionTemplate')
      .where('segment.event = :eventId', { eventId })
      .orderBy('segment.sortOrder', 'ASC')
      .addOrderBy('instance.sortOrder', 'ASC')
      .getMany();

    const countMap = await this.loadAssignmentCounts(
      segments.flatMap((s) => (s.instances ?? []).map((i) => i.id)),
    );

    return segments.map((s) => toSegmentWithInstances(s, countMap));
  }

  async create(eventId: string, dto: CreateSegmentDto): Promise<SegmentDetail> {
    const event = await this.assertEventExists(eventId);

    const maxOrder = await this.segmentRepository
      .createQueryBuilder('segment')
      .select('MAX(segment.sortOrder)', 'max')
      .where('segment.event = :eventId', { eventId })
      .getRawOne<{ max: number | null }>();

    const sortOrder = (maxOrder?.max ?? -1) + 1;

    const segment = this.segmentRepository.create({
      event,
      name: dto.name ?? null,
      sortOrder,
      startTime: dto.startTime ?? null,
      endTime: dto.endTime ?? null,
      notes: dto.notes ?? null,
      isVisible: false,
    });

    const saved = await this.segmentRepository.save(segment);
    return this.findOneById(saved.id);
  }

  async update(eventId: string, segmentId: string, dto: UpdateSegmentDto): Promise<SegmentDetail> {
    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);

    if (dto.name !== undefined) segment.name = dto.name;
    if (dto.startTime !== undefined) segment.startTime = dto.startTime ?? null;
    if (dto.endTime !== undefined) segment.endTime = dto.endTime ?? null;
    if (dto.notes !== undefined) segment.notes = dto.notes ?? null;
    if (dto.isVisible !== undefined) segment.isVisible = dto.isVisible;

    await this.segmentRepository.save(segment);
    return this.findOneById(segment.id);
  }

  async remove(eventId: string, segmentId: string): Promise<void> {
    const segment = await this.assertSegmentBelongsToEvent(eventId, segmentId);
    await this.segmentRepository.remove(segment);
  }

  async reorder(eventId: string, dto: ReorderSegmentsDto): Promise<void> {
    await this.assertEventExists(eventId);

    const existing = await this.segmentRepository.find({
      where: { event: { id: eventId } },
      select: ['id'],
    });

    const existingIds = new Set(existing.map((s) => s.id));
    const dtoIds = new Set(dto.segmentIds);

    const invalid = dto.segmentIds.filter((id) => !existingIds.has(id));
    if (invalid.length > 0) {
      throw new BadRequestException(
        `Segment IDs not found in event: ${invalid.join(', ')}`,
      );
    }

    const missing = existing.filter((s) => !dtoIds.has(s.id)).map((s) => s.id);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Reorder must include all segments. Missing: ${missing.join(', ')}`,
      );
    }

    await this.dataSource.transaction(async (manager) => {
      for (let i = 0; i < dto.segmentIds.length; i++) {
        await manager.update(EventSegment, { id: dto.segmentIds[i] }, { sortOrder: i });
      }
    });
  }

  private async assertEventExists(eventId: string): Promise<Event> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
    return event;
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

  private async findOneById(id: string): Promise<SegmentDetail> {
    const segment = await this.segmentRepository
      .createQueryBuilder('segment')
      .leftJoinAndSelect('segment.instances', 'instance')
      .leftJoinAndSelect('instance.figureTemplate', 'figureTemplate')
      .leftJoinAndSelect('instance.compositionTemplate', 'compositionTemplate')
      .where('segment.id = :id', { id })
      .orderBy('instance.sortOrder', 'ASC')
      .getOne();

    if (!segment) {
      throw new NotFoundException(`Segment with ID ${id} not found`);
    }

    const countMap = await this.loadAssignmentCounts(
      (segment.instances ?? []).map((i) => i.id),
    );

    return toSegmentWithInstances(segment, countMap);
  }

  private async loadAssignmentCounts(instanceIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (instanceIds.length === 0) return map;
    const rows: { figureInstanceId: string; count: string }[] = await this.dataSource.query(
      `SELECT "figureInstanceId", COUNT(*) as count FROM node_assignments WHERE "figureInstanceId" = ANY($1) GROUP BY "figureInstanceId"`,
      [instanceIds],
    );
    for (const row of rows) {
      map.set(row.figureInstanceId, parseInt(row.count, 10));
    }
    return map;
  }
}

function toSegmentWithInstances(segment: EventSegment, countMap: Map<string, number>): SegmentDetail {
  return {
    id: segment.id,
    name: segment.name,
    sortOrder: segment.sortOrder,
    startTime: segment.startTime,
    endTime: segment.endTime,
    notes: segment.notes,
    isVisible: segment.isVisible,
    instances: (segment.instances ?? []).map<InstanceRef>((instance) => ({
      id: instance.id,
      label: instance.label,
      sortOrder: instance.sortOrder,
      snapshotted: instance.snapshotted,
      sourceVariantOrder: instance.sourceVariantOrder,
      assignedCount: countMap.get(instance.id) ?? 0,
      numberOfCordons: instance.numberOfCordons,
      openCordons: instance.openCordons,
      projectionX: instance.projectionX ?? null,
      projectionY: instance.projectionY ?? null,
      projectionScale: instance.projectionScale ?? 1,
      figureTemplate: instance.figureTemplate
        ? { id: instance.figureTemplate.id, name: instance.figureTemplate.name }
        : null,
      compositionTemplate: instance.compositionTemplate
        ? { id: instance.compositionTemplate.id, name: instance.compositionTemplate.name }
        : null,
    })),
  };
}
