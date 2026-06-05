import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  FigureFamilyVariant,
  FigureFamilyListItem,
  FigureFamilyDetail,
} from '@muixer/shared';
import { FigureFamily } from './entities/figure-family.entity';
import { CreateFigureFamilyDto } from './dto/create-figure-family.dto';
import { UpdateFigureFamilyDto } from './dto/update-figure-family.dto';
import { FigureFamilyFilterDto } from './dto/figure-family-filter.dto';

@Injectable()
export class FigureFamilyService {
  constructor(
    @InjectRepository(FigureFamily)
    private readonly familyRepository: Repository<FigureFamily>,
  ) {}

  async findAll(
    filters: FigureFamilyFilterDto,
  ): Promise<{ data: FigureFamilyListItem[]; total: number }> {
    const { search, page = 1, limit = 25 } = filters;

    const qb = this.familyRepository
      .createQueryBuilder('family')
      .loadRelationCountAndMap('family.variantCount', 'family.templates');

    if (search) {
      qb.andWhere(
        '(unaccent(family.name) ILIKE unaccent(:search) OR family.slug ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const families = await qb
      .orderBy('family.name', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: families.map(toListItem), total };
  }

  async findOne(id: string): Promise<FigureFamilyDetail> {
    const family = await this.familyRepository.findOne({
      where: { id },
      relations: ['templates', 'templates.nodes', 'templates.rengles'],
    });

    if (!family) {
      throw new NotFoundException(`FigureFamily with ID ${id} not found`);
    }

    return toDetailItem(family);
  }

  async create(dto: CreateFigureFamilyDto): Promise<FigureFamilyDetail> {
    await this.assertSlugAvailable(dto.slug);

    const family = this.familyRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      metadata: dto.metadata ?? {},
    });

    let saved: FigureFamily;
    try {
      saved = await this.familyRepository.save(family);
    } catch (err) {
      this.handleDbError(err);
    }

    return this.findOne(saved!.id);
  }

  async update(id: string, dto: UpdateFigureFamilyDto): Promise<FigureFamilyDetail> {
    const family = await this.familyRepository.findOne({ where: { id } });

    if (!family) {
      throw new NotFoundException(`FigureFamily with ID ${id} not found`);
    }

    if (dto.name !== undefined) family.name = dto.name;
    if (dto.slug !== undefined) {
      await this.assertSlugAvailable(dto.slug, id);
      family.slug = dto.slug;
    }
    if (dto.description !== undefined) family.description = dto.description ?? null;
    if (dto.metadata !== undefined) family.metadata = dto.metadata ?? {};

    try {
      await this.familyRepository.save(family);
    } catch (err) {
      this.handleDbError(err);
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const family = await this.familyRepository.findOne({
      where: { id },
      relations: ['templates'],
    });

    if (!family) {
      throw new NotFoundException(`FigureFamily with ID ${id} not found`);
    }

    if (family.templates && family.templates.length > 0) {
      throw new ConflictException(
        `No es pot esborrar: la família té ${family.templates.length} variant(s) associada(es).`,
      );
    }

    await this.familyRepository.remove(family);
  }

  private async assertSlugAvailable(slug: string, excludeId?: string): Promise<void> {
    const existing = await this.familyRepository.findOne({ where: { slug } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure family`,
      );
    }
  }

  private handleDbError(err: unknown): never {
    const pgErr = err as { code?: string; detail?: string };
    if (pgErr?.code === '23505') {
      const slugMatch = pgErr.detail?.match(/Key \(slug\)=\(([^)]+)\)/);
      const slug = slugMatch ? slugMatch[1] : 'unknown';
      throw new ConflictException(
        `The slug "${slug}" is already in use by another figure family`,
      );
    }
    throw new InternalServerErrorException('Unexpected database error');
  }
}

function toListItem(
  family: FigureFamily & { variantCount?: number },
): FigureFamilyListItem {
  return {
    id: family.id,
    name: family.name,
    slug: family.slug,
    description: family.description,
    variantCount: (family as unknown as { variantCount: number }).variantCount ?? 0,
    createdAt: family.createdAt.toISOString(),
    updatedAt: family.updatedAt.toISOString(),
  };
}

function toDetailItem(family: FigureFamily): FigureFamilyDetail {
  const templates = family.templates ?? [];
  const sorted = [...templates].sort((a, b) => a.variantOrder - b.variantOrder);

  return {
    ...toListItem(family),
    variantCount: templates.length,
    metadata: family.metadata,
    variants: sorted.map<FigureFamilyVariant>((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      variantOrder: t.variantOrder,
      nodeCount: t.nodes?.length ?? 0,
      renglaCount: t.rengles?.length ?? 0,
    })),
  };
}
