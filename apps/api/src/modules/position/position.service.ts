import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './position.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

export type PositionWithCount = Position & { personCount: number };

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  async findAll(): Promise<PositionWithCount[]> {
    const result = await this.positionRepository
      .createQueryBuilder('position')
      .leftJoin('person_positions', 'pp', 'pp."positionsId" = position.id')
      .addSelect('CAST(COUNT(pp."personsId") AS int)', 'personCount')
      .groupBy('position.id')
      .orderBy('position.name', 'ASC')
      .getRawAndEntities();

    return result.entities.map((entity, index) => ({
      ...entity,
      personCount: result.raw[index]?.personCount ?? 0,
    }));
  }

  async findOne(id: string): Promise<Position> {
    const position = await this.positionRepository.findOne({ where: { id } });
    if (!position) {
      throw new NotFoundException(`Position with ID ${id} not found`);
    }
    return position;
  }

  async create(createPositionDto: CreatePositionDto): Promise<Position> {
    const position = this.positionRepository.create(createPositionDto);
    return this.saveWithUniqueGuard(position);
  }

  async update(id: string, updatePositionDto: UpdatePositionDto): Promise<Position> {
    await this.findOne(id);
    const merged = this.positionRepository.create({ id, ...updatePositionDto });
    await this.saveWithUniqueGuard(merged);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);

    const [{ count }] = await this.positionRepository.query(
      `SELECT COUNT(*)::int AS count FROM person_positions WHERE "positionsId" = $1`,
      [id],
    );

    if (count > 0) {
      throw new ConflictException(
        "No es pot esborrar: hi ha persones amb aquesta posició assignada.",
      );
    }

    await this.positionRepository.delete(id);
  }

  private async saveWithUniqueGuard(entity: Position): Promise<Position> {
    try {
      return await this.positionRepository.save(entity);
    } catch (error: unknown) {
      if (error instanceof Object && 'code' in error && error.code === '23505') {
        throw new ConflictException(
          "L'identificador ja l'utilitza una altra posició. Canvia'l.",
        );
      }
      throw error;
    }
  }
}
