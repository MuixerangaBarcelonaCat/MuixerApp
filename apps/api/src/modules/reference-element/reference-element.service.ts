import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ReferenceElementItem } from '@muixer/shared';
import { ReferenceElement } from './entities/reference-element.entity';
import { Event } from '../event/event.entity';
import { CreateReferenceElementDto } from './dto/create-reference-element.dto';
import { UpdateReferenceElementDto } from './dto/update-reference-element.dto';
import { BatchUpdateReferenceElementsDto } from './dto/batch-update-reference-elements.dto';
import { ToggleVisibilityDto } from './dto/toggle-visibility.dto';

@Injectable()
export class ReferenceElementService {
  constructor(
    @InjectRepository(ReferenceElement)
    private readonly elementRepository: Repository<ReferenceElement>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  async findByEvent(eventId: string): Promise<ReferenceElement[]> {
    await this.assertEventExists(eventId);

    return this.elementRepository.find({
      where: { event: { id: eventId } },
      order: { sortOrder: 'ASC' },
    });
  }

  async create(
    eventId: string,
    dto: CreateReferenceElementDto,
  ): Promise<ReferenceElement> {
    await this.assertEventExists(eventId);

    const maxResult = await this.elementRepository
      .createQueryBuilder('el')
      .select('MAX(el.sortOrder)', 'max')
      .where('el.eventId = :eventId', { eventId })
      .getRawOne<{ max: number | null }>();

    const sortOrder = (maxResult?.max ?? -1) + 1;

    const element = this.elementRepository.create({
      event: { id: eventId } as Event,
      type: dto.type,
      label: dto.label ?? null,
      x: dto.x,
      y: dto.y,
      width: dto.width,
      height: dto.height,
      rotation: dto.rotation ?? 0,
      color: dto.color ?? null,
      sortOrder,
      hiddenInSegments: [],
    });

    return this.elementRepository.save(element);
  }

  async update(
    eventId: string,
    id: string,
    dto: UpdateReferenceElementDto,
  ): Promise<ReferenceElement> {
    const element = await this.findOneOrFail(eventId, id);

    Object.assign(element, {
      ...(dto.type !== undefined && { type: dto.type }),
      ...(dto.label !== undefined && { label: dto.label }),
      ...(dto.x !== undefined && { x: dto.x }),
      ...(dto.y !== undefined && { y: dto.y }),
      ...(dto.width !== undefined && { width: dto.width }),
      ...(dto.height !== undefined && { height: dto.height }),
      ...(dto.rotation !== undefined && { rotation: dto.rotation }),
      ...(dto.color !== undefined && { color: dto.color }),
    });

    return this.elementRepository.save(element);
  }

  async batchUpdate(
    eventId: string,
    dto: BatchUpdateReferenceElementsDto,
  ): Promise<void> {
    await this.assertEventExists(eventId);

    await this.dataSource.transaction(async (manager) => {
      for (const item of dto.elements) {
        await manager.update(
          ReferenceElement,
          { id: item.id, event: { id: eventId } },
          {
            x: item.x,
            y: item.y,
            width: item.width,
            height: item.height,
            rotation: item.rotation,
          },
        );
      }
    });
  }

  async toggleVisibility(
    eventId: string,
    id: string,
    dto: ToggleVisibilityDto,
  ): Promise<ReferenceElement> {
    const element = await this.findOneOrFail(eventId, id);
    const current = element.hiddenInSegments ?? [];

    if (dto.hidden) {
      if (!current.includes(dto.segmentId)) {
        element.hiddenInSegments = [...current, dto.segmentId];
      }
    } else {
      element.hiddenInSegments = current.filter((sid) => sid !== dto.segmentId);
    }

    return this.elementRepository.save(element);
  }

  async remove(eventId: string, id: string): Promise<void> {
    const element = await this.findOneOrFail(eventId, id);
    await this.elementRepository.remove(element);
  }

  private async assertEventExists(eventId: string): Promise<void> {
    const exists = await this.eventRepository.existsBy({ id: eventId });
    if (!exists) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }
  }

  private async findOneOrFail(
    eventId: string,
    id: string,
  ): Promise<ReferenceElement> {
    const element = await this.elementRepository.findOne({
      where: { id, event: { id: eventId } },
    });
    if (!element) {
      throw new NotFoundException(
        `ReferenceElement with ID ${id} not found for event ${eventId}`,
      );
    }
    return element;
  }

  static toItem(element: ReferenceElement): ReferenceElementItem {
    return {
      id: element.id,
      type: element.type,
      label: element.label,
      x: element.x,
      y: element.y,
      width: element.width,
      height: element.height,
      rotation: element.rotation,
      color: element.color,
      sortOrder: element.sortOrder,
      hiddenInSegments: element.hiddenInSegments,
    };
  }
}
