import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CompositionTemplate } from './entities/composition-template.entity';
import { CompositionSlot } from './entities/composition-slot.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { CreateCompositionTemplateDto } from './dto/create-composition-template.dto';
import { UpdateCompositionTemplateDto } from './dto/update-composition-template.dto';
import { CompositionTemplateFilterDto } from './dto/composition-template-filter.dto';
import { CreateCompositionSlotDto } from './dto/create-composition-slot.dto';
import { FigureNodeItem } from '../figure/figure-template.service';

export interface CompositionSlotItem {
  id: string;
  label: string | null;
  offsetX: number;
  offsetY: number;
  sortOrder: number;
  figureTemplate: {
    id: string;
    name: string;
    slug: string;
    hasPinya: boolean;
    direction: number;
    nodeCount: number;
    nodes: FigureNodeItem[];
  };
}

export interface CompositionTemplateListItem {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  slotCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CompositionTemplateDetailItem extends CompositionTemplateListItem {
  slots: CompositionSlotItem[];
}

@Injectable()
export class CompositionTemplateService {
  constructor(
    @InjectRepository(CompositionTemplate)
    private readonly compositionRepository: Repository<CompositionTemplate>,
    @InjectRepository(CompositionSlot)
    private readonly slotRepository: Repository<CompositionSlot>,
    @InjectRepository(FigureTemplate)
    private readonly figureTemplateRepository: Repository<FigureTemplate>,
    @InjectRepository(FigureInstance)
    private readonly figureInstanceRepository: Repository<FigureInstance>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    filters: CompositionTemplateFilterDto,
  ): Promise<{ data: CompositionTemplateListItem[]; total: number }> {
    const { search, page = 1, limit = 25 } = filters;

    const qb = this.compositionRepository
      .createQueryBuilder('composition')
      .loadRelationCountAndMap('composition.slotCount', 'composition.slots');

    if (search) {
      qb.andWhere(
        '(unaccent(composition.name) ILIKE unaccent(:search) OR composition.slug ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const compositions = await qb
      .orderBy('composition.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: compositions.map(toListItem), total };
  }

  async findOne(id: string): Promise<CompositionTemplateDetailItem> {
    const composition = await this.compositionRepository.findOne({
      where: { id },
      relations: ['slots', 'slots.figureTemplate', 'slots.figureTemplate.nodes'],
    });

    if (!composition) {
      throw new NotFoundException(`CompositionTemplate with ID ${id} not found`);
    }

    return toDetailItem(composition);
  }

  async create(dto: CreateCompositionTemplateDto): Promise<CompositionTemplateDetailItem> {
    await this.assertSlugAvailable(dto.slug);

    const composition = this.compositionRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
    });

    const saved = await this.compositionRepository.save(composition);

    if (dto.slots && dto.slots.length > 0) {
      await this.createSlots(saved, dto.slots);
    }

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCompositionTemplateDto,
  ): Promise<CompositionTemplateDetailItem> {
    const composition = await this.compositionRepository.findOne({ where: { id } });

    if (!composition) {
      throw new NotFoundException(`CompositionTemplate with ID ${id} not found`);
    }

    if (dto.name !== undefined) composition.name = dto.name;
    if (dto.slug !== undefined) {
      await this.assertSlugAvailable(dto.slug, id);
      composition.slug = dto.slug;
    }
    if (dto.description !== undefined) composition.description = dto.description ?? null;

    await this.compositionRepository.save(composition);

    if (dto.slots !== undefined) {
      await this.syncSlots(composition, dto.slots);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const composition = await this.compositionRepository.findOne({ where: { id } });

    if (!composition) {
      throw new NotFoundException(`CompositionTemplate with ID ${id} not found`);
    }

    const instanceCount = await this.figureInstanceRepository.count({
      where: { compositionTemplate: { id } },
    });

    if (instanceCount > 0) {
      throw new ConflictException(
        `Aquesta composició s'utilitza a ${instanceCount} event(s) i no es pot eliminar.`,
      );
    }

    await this.compositionRepository.remove(composition);
  }

  async duplicate(id: string): Promise<CompositionTemplateDetailItem> {
    const original = await this.compositionRepository.findOne({
      where: { id },
      relations: ['slots', 'slots.figureTemplate'],
    });

    if (!original) {
      throw new NotFoundException(`CompositionTemplate with ID ${id} not found`);
    }

    const copy = this.compositionRepository.create({
      name: `${original.name} (còpia)`,
      slug: `${original.slug}-copia-${Date.now()}`,
      description: original.description,
    });

    const savedCopy = await this.compositionRepository.save(copy);

    if (original.slots && original.slots.length > 0) {
      await this.createSlots(
        savedCopy,
        original.slots.map(slotToCreateDto),
      );
    }

    return this.findOne(savedCopy.id);
  }

  private async createSlots(
    composition: CompositionTemplate,
    dtos: CreateCompositionSlotDto[],
  ): Promise<void> {
    const slots: CompositionSlot[] = [];

    for (const dto of dtos) {
      const figureTemplate = await this.figureTemplateRepository.findOne({
        where: { id: dto.figureTemplateId },
      });

      if (!figureTemplate) {
        throw new NotFoundException(
          `FigureTemplate with ID ${dto.figureTemplateId} not found`,
        );
      }

      slots.push(
        this.slotRepository.create({
          composition,
          figureTemplate,
          label: dto.label ?? null,
          offsetX: dto.offsetX,
          offsetY: dto.offsetY,
          sortOrder: dto.sortOrder ?? 0,
        }),
      );
    }

    await this.slotRepository.save(slots);
  }

  /**
   * C2 fix: atomic slot replacement.
   * 1. Pre-validate all figureTemplateIds in one batched query to fail fast
   *    BEFORE any delete occurs.
   * 2. Wrap delete + recreate in a transaction so a failed create rolls back the
   *    delete, preventing loss of all slots on a bad request.
   */
  private async syncSlots(
    composition: CompositionTemplate,
    incomingDtos: CreateCompositionSlotDto[],
  ): Promise<void> {
    let templateMap = new Map<string, FigureTemplate>();

    if (incomingDtos.length > 0) {
      const templateIds = [...new Set(incomingDtos.map((dto) => dto.figureTemplateId))];
      const templates = await this.figureTemplateRepository.find({
        where: { id: In(templateIds) },
      });
      templateMap = new Map(templates.map((t) => [t.id, t]));

      const missing = templateIds.filter((id) => !templateMap.has(id));
      if (missing.length > 0) {
        throw new NotFoundException(`FigureTemplate IDs not found: ${missing.join(', ')}`);
      }
    }

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(CompositionSlot, { composition: { id: composition.id } });

      if (incomingDtos.length > 0) {
        const slots = incomingDtos.map((dto) =>
          manager.create(CompositionSlot, {
            composition,
            figureTemplate: templateMap.get(dto.figureTemplateId)!,
            label: dto.label ?? null,
            offsetX: dto.offsetX,
            offsetY: dto.offsetY,
            sortOrder: dto.sortOrder ?? 0,
          }),
        );
        await manager.save(CompositionSlot, slots);
      }
    });
  }

  // H5 fix: slug uniqueness check mirroring the figure-template pattern.
  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.compositionRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The slug "${slug}" is already in use by another composition`,
      );
    }
  }
}

function slotToCreateDto(slot: CompositionSlot): CreateCompositionSlotDto {
  return {
    figureTemplateId: slot.figureTemplate.id,
    label: slot.label ?? undefined,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    sortOrder: slot.sortOrder,
  };
}

function toListItem(
  composition: CompositionTemplate & { slotCount?: number },
): CompositionTemplateListItem {
  return {
    id: composition.id,
    name: composition.name,
    slug: composition.slug,
    description: composition.description,
    slotCount: (composition as unknown as { slotCount: number }).slotCount ?? 0,
    createdAt: composition.createdAt,
    updatedAt: composition.updatedAt,
  };
}

function toDetailItem(composition: CompositionTemplate): CompositionTemplateDetailItem {
  const slots: CompositionSlotItem[] = (composition.slots ?? []).map((slot) => ({
    id: slot.id,
    label: slot.label,
    offsetX: slot.offsetX,
    offsetY: slot.offsetY,
    sortOrder: slot.sortOrder,
    figureTemplate: {
      id: slot.figureTemplate.id,
      name: slot.figureTemplate.name,
      slug: slot.figureTemplate.slug,
      hasPinya: slot.figureTemplate.hasPinya,
      direction: slot.figureTemplate.direction,
      nodeCount: (slot.figureTemplate.nodes ?? []).length,
      nodes: (slot.figureTemplate.nodes ?? []).map((node) => ({
        id: node.id,
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
        ringLevel: node.ringLevel ?? null,
        originNodeId: node.originNodeId ?? null,
        renglaId: node.renglaId ?? null,
        renglaPosition: node.renglaPosition ?? null,
        metadata: node.metadata,
      })),
    },
  }));

  return {
    ...toListItem(composition),
    slots,
  };
}
