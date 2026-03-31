import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Person } from './person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';
import { PersonResponseDto } from './dto/person-response.dto';
import { Position } from '../position/position.entity';

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
  ) {}

  async findAll(filters: PersonFilterDto): Promise<{ data: PersonResponseDto[]; total: number }> {
    const { search, positionId, availability, isActive, isXicalla, isMember, page = 1, limit = 50 } = filters;

    const queryBuilder = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'position')
      .leftJoinAndSelect('person.mentor', 'mentor');

    if (search) {
      queryBuilder.andWhere(
        '(person.alias ILIKE :search OR person.name ILIKE :search OR person.firstSurname ILIKE :search OR person.secondSurname ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (positionId) {
      queryBuilder.andWhere('position.id = :positionId', { positionId });
    }

    if (availability !== undefined) {
      queryBuilder.andWhere('person.availability = :availability', { availability });
    }

    if (isActive !== undefined) {
      queryBuilder.andWhere('person.isActive = :isActive', { isActive });
    }

    if (isXicalla !== undefined) {
      queryBuilder.andWhere('person.isXicalla = :isXicalla', { isXicalla });
    }

    if (isMember !== undefined) {
      queryBuilder.andWhere('person.isMember = :isMember', { isMember });
    }

    const total = await queryBuilder.getCount();

    const data = await queryBuilder
      .orderBy('person.alias', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const responseData = plainToInstance(PersonResponseDto, data, {
      excludeExtraneousValues: true,
    });

    return { data: responseData, total };
  }

  async findOne(id: string): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor', 'managedBy'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    return plainToInstance(PersonResponseDto, person, {
      excludeExtraneousValues: true,
    });
  }

  async create(createPersonDto: CreatePersonDto): Promise<PersonResponseDto> {
    const { positionIds, mentorId, ...personData } = createPersonDto;

    const person = this.personRepository.create(personData);

    if (positionIds && positionIds.length > 0) {
      person.positions = await this.positionRepository.findByIds(positionIds);
    }

    if (mentorId) {
      const mentor = await this.personRepository.findOne({ where: { id: mentorId } });
      if (!mentor) {
        throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
      }
      person.mentor = mentor;
    }

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async update(id: string, updatePersonDto: UpdatePersonDto): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }
    const { positionIds, mentorId, ...personData } = updatePersonDto;

    Object.assign(person, personData);

    if (positionIds !== undefined) {
      if (positionIds.length > 0) {
        person.positions = await this.positionRepository.findByIds(positionIds);
      } else {
        person.positions = [];
      }
    }

    if (mentorId !== undefined) {
      if (mentorId) {
        const mentor = await this.personRepository.findOne({ where: { id: mentorId } });
        if (!mentor) {
          throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
        }
        person.mentor = mentor;
      } else {
        person.mentor = null;
      }
    }

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async softDelete(id: string): Promise<void> {
    const person = await this.personRepository.findOne({ where: { id } });
    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }
    person.isActive = false;
    await this.personRepository.save(person);
  }

  async deactivate(id: string): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    person.isActive = false;
    person.lastSyncedAt = new Date();

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  async activate(id: string): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    person.isActive = true;
    person.lastSyncedAt = new Date();

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }
}
