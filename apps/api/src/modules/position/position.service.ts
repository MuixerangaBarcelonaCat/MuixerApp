import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Position } from './position.entity';
import { CreatePositionDto } from './dto/create-position.dto';
import { UpdatePositionDto } from './dto/update-position.dto';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  async findAll(): Promise<Position[]> {
    return this.positionRepository.find({
      order: { name: 'ASC' },
    });
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
    return this.positionRepository.save(position);
  }

  async update(id: string, updatePositionDto: UpdatePositionDto): Promise<Position> {
    await this.findOne(id);
    await this.positionRepository.update(id, updatePositionDto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.positionRepository.delete(id);
  }
}
