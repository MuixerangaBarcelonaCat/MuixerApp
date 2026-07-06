import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';

export type TagWithCount = Tag & { personCount: number };

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
  ) {}

  async findAll(): Promise<TagWithCount[]> {
    const result = await this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('person_positions', 'pp', 'pp."positionsId" = tag.id')
      .addSelect('CAST(COUNT(pp."personsId") AS int)', 'personCount')
      .groupBy('tag.id')
      .orderBy('tag.name', 'ASC')
      .getRawAndEntities();

    return result.entities.map((entity, index) => ({
      ...entity,
      personCount: result.raw[index]?.personCount ?? 0,
    }));
  }

  async findOne(id: string): Promise<Tag> {
    const tag = await this.tagRepository.findOne({ where: { id } });
    if (!tag) {
      throw new NotFoundException(`Tag with ID ${id} not found`);
    }
    return tag;
  }

  async create(createTagDto: CreateTagDto): Promise<Tag> {
    const tag = this.tagRepository.create(createTagDto);
    return this.saveWithUniqueGuard(tag);
  }

  async update(id: string, updateTagDto: UpdateTagDto): Promise<Tag> {
    await this.findOne(id);
    const merged = this.tagRepository.create({ id, ...updateTagDto });
    await this.saveWithUniqueGuard(merged);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const [{ count }] = await this.tagRepository.query(
      `SELECT COUNT(*)::int AS count FROM person_positions WHERE "positionsId" = $1`,
      [id],
    );

    if (count > 0) {
      throw new ConflictException(
        "No es pot esborrar: hi ha persones amb aquesta etiqueta assignada.",
      );
    }

    await this.tagRepository.delete(id);
  }

  private async saveWithUniqueGuard(entity: Tag): Promise<Tag> {
    try {
      return await this.tagRepository.save(entity);
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new ConflictException(
          "L'identificador ja l'utilitza una altra etiqueta. Canvia'l.",
        );
      }
      throw error;
    }
  }
}
