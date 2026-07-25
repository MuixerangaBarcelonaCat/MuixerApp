import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

    const delegate = this.delegateRepo.create({
      person,
      user,
      delegateType: dto.delegateType,
    });

    return this.delegateRepo.save(delegate);
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

    return this.delegateRepo.save(delegate);
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
