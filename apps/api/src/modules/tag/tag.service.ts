import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Tag } from './tag.entity';
import { Person } from '../person/person.entity';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { TagFilterDto } from './dto/tag-filter.dto';

export type TagWithCount = Tag & { personCount: number };

@Injectable()
export class TagService {
  constructor(
    @InjectRepository(Tag)
    private readonly tagRepository: Repository<Tag>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  async findAll(filter?: TagFilterDto): Promise<TagWithCount[]> {
    const qb = this.tagRepository
      .createQueryBuilder('tag')
      .leftJoin('person_positions', 'pp', 'pp."positionsId" = tag.id')
      .addSelect('CAST(COUNT(pp."personsId") AS int)', 'personCount');

    if (filter?.category?.length) {
      qb.andWhere('tag.category IN (:...categories)', { categories: filter.category });
    }

    const result = await qb.groupBy('tag.id').orderBy('tag.name', 'ASC').getRawAndEntities();

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

  async assignPersons(tagId: string, personIds: string[]): Promise<void> {
    await this.findOne(tagId);

    const uniqueIds = [...new Set(personIds)];
    const found = await this.personRepository.findBy({ id: In(uniqueIds) });
    if (found.length !== uniqueIds.length) {
      throw new NotFoundException("Alguna de les persones indicades no existeix.");
    }

    // ponytail: row-per-value INSERT, fine at this batch size (form-driven assignment, not bulk import)
    await this.tagRepository.manager.transaction((manager) =>
      Promise.all(
        uniqueIds.map((personId) =>
          manager.query(
            `INSERT INTO person_positions ("personsId", "positionsId") VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [personId, tagId],
          ),
        ),
      ),
    );
  }

  async unassignPerson(tagId: string, personId: string): Promise<void> {
    await this.findOne(tagId);

    await this.tagRepository.query(
      `DELETE FROM person_positions WHERE "personsId" = $1 AND "positionsId" = $2`,
      [personId, tagId],
    );
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
