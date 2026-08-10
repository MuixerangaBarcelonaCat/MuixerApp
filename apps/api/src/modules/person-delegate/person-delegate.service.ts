import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { PersonDelegate } from './person-delegate.entity';
import { Person } from '../person/person.entity';
import { User } from '../user/user.entity';
import { CreatePersonDelegateDto } from './dto/create-person-delegate.dto';
import { UpdatePersonDelegateDto } from './dto/update-person-delegate.dto';

@Injectable()
export class PersonDelegateService {
  constructor(
    @InjectRepository(PersonDelegate)
    private readonly delegateRepo: Repository<PersonDelegate>,
    @InjectRepository(Person)
    private readonly personRepo: Repository<Person>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByPerson(personId: string): Promise<PersonDelegate[]> {
    return this.delegateRepo.find({
      where: { person: { id: personId } },
      relations: ['user', 'person'],
      order: { createdAt: 'ASC' },
    });
  }

  async findByUser(userId: string): Promise<PersonDelegate[]> {
    return this.delegateRepo.find({
      where: { user: { id: userId }, isActive: true },
      relations: ['user', 'person'],
      order: { createdAt: 'ASC' },
    });
  }

  async create(
    personId: string,
    dto: CreatePersonDelegateDto,
  ): Promise<PersonDelegate> {
    const person = await this.personRepo.findOne({
      where: { id: personId },
    });
    if (!person) {
      throw new NotFoundException(`Person #${personId} not found`);
    }

    const user = await this.userRepo.findOne({
      where: { id: dto.userId },
      relations: ['person'],
    });
    if (!user) {
      throw new NotFoundException(`User #${dto.userId} not found`);
    }

    if (user.person && user.person.id === personId) {
      throw new BadRequestException(
        'A user cannot delegate for their own linked person',
      );
    }

    const existing = await this.delegateRepo.findOne({
      where: { user: { id: dto.userId }, person: { id: personId } },
    });
    if (existing) {
      throw new ConflictException(
        'This user is already a delegate for this person',
      );
    }

    if (!dto.isPrimary) {
      const delegate = this.delegateRepo.create({
        person,
        user,
        delegateType: dto.delegateType,
        isPrimary: false,
      });
      return this.delegateRepo.save(delegate);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PersonDelegate);
      await repo.update({ person: { id: personId } }, { isPrimary: false });
      const delegate = repo.create({
        person,
        user,
        delegateType: dto.delegateType,
        isPrimary: true,
      });
      return repo.save(delegate);
    });
  }

  async update(
    personId: string,
    id: string,
    dto: UpdatePersonDelegateDto,
  ): Promise<PersonDelegate> {
    const delegate = await this.delegateRepo.findOne({
      where: { id, person: { id: personId } },
      relations: ['user', 'person'],
    });
    if (!delegate) {
      throw new NotFoundException(`Delegate #${id} not found`);
    }

    if (dto.delegateType !== undefined) {
      delegate.delegateType = dto.delegateType;
    }
    if (dto.isActive !== undefined) {
      delegate.isActive = dto.isActive;
    }

    if (dto.isPrimary !== true) {
      if (dto.isPrimary === false) {
        delegate.isPrimary = false;
      }
      return this.delegateRepo.save(delegate);
    }

    return this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(PersonDelegate);
      await repo.update({ person: { id: personId } }, { isPrimary: false });
      delegate.isPrimary = true;
      return repo.save(delegate);
    });
  }

  async getPrimary(personId: string): Promise<PersonDelegate | null> {
    return this.delegateRepo.findOne({
      where: { person: { id: personId }, isPrimary: true },
      relations: ['user', 'person'],
    });
  }

  async remove(personId: string, id: string): Promise<void> {
    const delegate = await this.delegateRepo.findOne({
      where: { id, person: { id: personId } },
    });
    if (!delegate) {
      throw new NotFoundException(`Delegate #${id} not found`);
    }

    await this.delegateRepo.remove(delegate);
  }
}
