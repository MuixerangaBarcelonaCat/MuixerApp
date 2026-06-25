import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { Event } from '../event/event.entity';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { ReorderSegmentsDto } from './dto/reorder-segments.dto';
import { FigureMode } from '@muixer/shared';

export interface InstanceRef {
  id: string;
  label: string | null;
  sortOrder: number;
  snapshotted: boolean;
  assignedCount: number;
  pinyaAssignedCount: number;
  pinyaCapacity: number | null;
  totalCordons: number | null;
  numberOfCordons: number | null;
  figureMode: FigureMode;
  figureTemplate: { id: string; name: string; hasPinya: boolean } | null;
  compositionTemplate: { id: string; name: string } | null;
}

export interface TroncFloorData {
  z: number;
  isBase: boolean;
  slots: (string | null)[];
}

export interface InstanceTroncSummary {
  instanceId: string;
  floors: TroncFloorData[];
}

export interface SegmentWithInstances {
  id: string;
  name: string | null;
  sortOrder: number;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  isVisible: boolean;
  instances: InstanceRef[];
}

@Injectable()
export class EventSegmentService {
  constructor(
    @InjectRepository(EventSegment)
    private readonly segmentRepository: Repository<EventSegment>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllByEvent(eventId: string): Promise<SegmentWithInstances[]> {
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

    const instanceIds = segments.flatMap((s) => (s.instances ?? []).map((i) => i.id));

    const allInstances = segments.flatMap((s) => s.instances ?? []);
    const allTemplateIds = allInstances.filter((i) => i.figureTemplate).map((i) => i.figureTemplate!.id);

    const [countMap, pinyaAssignedMap, pinyaTemplateIds, pinyaCapacityMap, totalCordonsMap] = await Promise.all([
      this.loadAssignmentCounts(instanceIds),
      this.loadPinyaAssignmentCounts(instanceIds),
      this.loadPinyaTemplateIds(allTemplateIds),
      this.loadPinyaCapacities(allInstances),
      this.loadTotalCordons(allTemplateIds),
    ]);

    return segments.map((s) =>
      toSegmentWithInstances(s, countMap, pinyaAssignedMap, pinyaTemplateIds, pinyaCapacityMap, totalCordonsMap),
    );
  }

  async create(eventId: string, dto: CreateSegmentDto): Promise<SegmentWithInstances> {
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

  async update(eventId: string, segmentId: string, dto: UpdateSegmentDto): Promise<SegmentWithInstances> {
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
    const invalid = dto.segmentIds.filter((id) => !existingIds.has(id));

    if (invalid.length > 0) {
      throw new BadRequestException(
        `Segment IDs not found in event: ${invalid.join(', ')}`,
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

  private async findOneById(id: string): Promise<SegmentWithInstances> {
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

    const instances = segment.instances ?? [];
    const instanceIds = instances.map((i) => i.id);
    const templateIds = instances.filter((i) => i.figureTemplate).map((i) => i.figureTemplate!.id);

    const [countMap, pinyaAssignedMap, pinyaTemplateIds, pinyaCapacityMap, totalCordonsMap] = await Promise.all([
      this.loadAssignmentCounts(instanceIds),
      this.loadPinyaAssignmentCounts(instanceIds),
      this.loadPinyaTemplateIds(templateIds),
      this.loadPinyaCapacities(instances),
      this.loadTotalCordons(templateIds),
    ]);

    return toSegmentWithInstances(segment, countMap, pinyaAssignedMap, pinyaTemplateIds, pinyaCapacityMap, totalCordonsMap);
  }

  private async loadPinyaTemplateIds(templateIds: string[]): Promise<Set<string>> {
    const set = new Set<string>();
    if (templateIds.length === 0) return set;
    const rows: { templateId: string }[] = await this.dataSource.query(
      `SELECT DISTINCT "templateId" FROM figure_nodes WHERE zone = 'PINYA' AND "templateId" = ANY($1)`,
      [templateIds],
    );
    for (const row of rows) set.add(row.templateId);
    return set;
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

  private async loadPinyaAssignmentCounts(instanceIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (instanceIds.length === 0) return map;
    const rows: { figureInstanceId: string; count: string }[] = await this.dataSource.query(
      `SELECT na."figureInstanceId", COUNT(*) as count
       FROM node_assignments na
       JOIN instance_nodes inode ON na."instanceNodeId" = inode.id
       WHERE na."figureInstanceId" = ANY($1) AND inode.zone IN ('PINYA', 'BASE')
       GROUP BY na."figureInstanceId"`,
      [instanceIds],
    );
    for (const row of rows) {
      map.set(row.figureInstanceId, parseInt(row.count, 10));
    }
    return map;
  }

  private async loadPinyaCapacities(instances: { id: string; snapshotted: boolean; figureTemplate: { id: string } | null; numberOfCordons: number | null }[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (instances.length === 0) return map;

    const notSnapped = instances.filter((i) => !i.snapshotted && i.figureTemplate);
    const snapped = instances.filter((i) => i.snapshotted);

    if (notSnapped.length > 0) {
      const rows: { instance_id: string; capacity: string }[] = await this.dataSource.query(
        `SELECT fi.id as instance_id, COUNT(*) as capacity
         FROM figure_instances fi
         JOIN figure_nodes fn ON fn."templateId" = fi."figureTemplateId"
         LEFT JOIN rengles r ON r.id = fn."renglaId"
         WHERE fi.id = ANY($1)
         AND fn.zone IN ('PINYA', 'BASE')
         AND (fi."numberOfCordons" IS NULL OR fn.zone = 'BASE' OR r."sortOrder" < fi."numberOfCordons")
         GROUP BY fi.id`,
        [notSnapped.map((i) => i.id)],
      );
      for (const row of rows) map.set(row.instance_id, parseInt(row.capacity, 10));
    }

    if (snapped.length > 0) {
      const rows: { instance_id: string; capacity: string }[] = await this.dataSource.query(
        `SELECT in_."figureInstanceId" as instance_id, COUNT(*) as capacity
         FROM instance_nodes in_
         JOIN figure_instances fi ON fi.id = in_."figureInstanceId"
         LEFT JOIN rengles r ON r.id = in_."renglaId"
         WHERE in_."figureInstanceId" = ANY($1)
         AND in_.zone IN ('PINYA', 'BASE')
         AND (fi."numberOfCordons" IS NULL OR in_.zone = 'BASE' OR r."sortOrder" < fi."numberOfCordons")
         GROUP BY in_."figureInstanceId"`,
        [snapped.map((i) => i.id)],
      );
      for (const row of rows) map.set(row.instance_id, parseInt(row.capacity, 10));
    }

    return map;
  }

  private async loadTotalCordons(templateIds: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (templateIds.length === 0) return map;
    const rows: { templateId: string; total: string }[] = await this.dataSource.query(
      `SELECT "templateId", COUNT(*) as total FROM rengles WHERE "templateId" = ANY($1) GROUP BY "templateId"`,
      [templateIds],
    );
    for (const row of rows) map.set(row.templateId, parseInt(row.total, 10));
    return map;
  }

  async getTroncView(eventId: string): Promise<InstanceTroncSummary[]> {
    await this.assertEventExists(eventId);

    const rows: { instance_id: string; zone: string; z: number; sort_order: number; alias: string | null }[] =
      await this.dataSource.query(
        `SELECT
           in_."figureInstanceId" as instance_id,
           in_.zone,
           in_.z,
           in_."sortOrder" as sort_order,
           p.alias
         FROM instance_nodes in_
         JOIN figure_instances fi ON fi.id = in_."figureInstanceId"
         JOIN event_segments es ON es.id = fi."segmentId"
         LEFT JOIN node_assignments na ON na."instanceNodeId" = in_.id AND na."figureInstanceId" = in_."figureInstanceId"
         LEFT JOIN persons p ON p.id = na."personId"
         WHERE es."eventId" = $1
         AND in_.zone IN ('TRONC', 'BASE')
         ORDER BY in_."figureInstanceId", in_.z, in_."sortOrder"`,
        [eventId],
      );

    const byInstance = new Map<string, typeof rows>();
    for (const row of rows) {
      if (!byInstance.has(row.instance_id)) byInstance.set(row.instance_id, []);
      byInstance.get(row.instance_id)!.push(row);
    }

    const result: InstanceTroncSummary[] = [];

    for (const [instanceId, nodeRows] of byInstance) {
      const byFloor = new Map<number, { isBase: boolean; slots: (string | null)[] }>();

      for (const row of nodeRows) {
        const isBase = row.zone === 'BASE';
        const key = isBase ? -1 : row.z;
        if (!byFloor.has(key)) byFloor.set(key, { isBase, slots: [] });
        byFloor.get(key)!.slots.push(row.alias ?? null);
      }

      const floors: TroncFloorData[] = Array.from(byFloor.entries())
        .map(([key, { isBase, slots }]) => ({ z: isBase ? 0 : key, isBase, slots }))
        .sort((a, b) => (a.isBase ? -1 : b.isBase ? 1 : a.z - b.z));

      result.push({ instanceId, floors });
    }

    return result;
  }
}

function toSegmentWithInstances(
  segment: EventSegment,
  countMap: Map<string, number>,
  pinyaAssignedMap: Map<string, number>,
  pinyaTemplateIds: Set<string>,
  pinyaCapacityMap: Map<string, number>,
  totalCordonsMap: Map<string, number>,
): SegmentWithInstances {
  return {
    id: segment.id,
    name: segment.name,
    sortOrder: segment.sortOrder,
    startTime: segment.startTime,
    endTime: segment.endTime,
    notes: segment.notes,
    isVisible: segment.isVisible,
    instances: (segment.instances ?? []).map((instance) => {
      const hasPinya = instance.figureTemplate ? pinyaTemplateIds.has(instance.figureTemplate.id) : false;
      const showPinyaData = hasPinya && instance.figureMode !== FigureMode.REMAT && instance.figureMode !== FigureMode.NETA;
      return {
        id: instance.id,
        label: instance.label,
        sortOrder: instance.sortOrder,
        snapshotted: instance.snapshotted,
        assignedCount: countMap.get(instance.id) ?? 0,
        pinyaAssignedCount: pinyaAssignedMap.get(instance.id) ?? 0,
        pinyaCapacity: showPinyaData ? (pinyaCapacityMap.get(instance.id) ?? 0) : null,
        totalCordons: showPinyaData && instance.figureTemplate
          ? (totalCordonsMap.get(instance.figureTemplate.id) ?? 0)
          : null,
        numberOfCordons: instance.numberOfCordons ?? null,
        figureMode: instance.figureMode,
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
    }),
  };
}
