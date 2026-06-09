import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Person } from './person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';
import { PersonResponseDto } from './dto/person-response.dto';
import { Position } from '../position/position.entity';
import { User } from '../user/user.entity';
import {
  PERSON_SORT_COLUMN_MAP,
  type PersonSortByField,
  type PersonSortOrder,
} from './constants/person-sort.constants';

const PROVISIONAL_PREFIX = '~';
const MAX_ALIAS_LENGTH = 20;

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Position)
    private readonly positionRepository: Repository<Position>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /** Retorna una llista paginada i ordenada de persones aplicant tots els filtres disponibles. Usa `unaccent` per cerques insensibles a accents. */
  async findAll(
    filters: PersonFilterDto,
  ): Promise<{ data: PersonResponseDto[]; total: number }> {
    const {
      search,
      positionIds,
      availability,
      isActive,
      isXicalla,
      isMember,
      isProvisional,
      page = 1,
      limit = 50,
      sortBy,
      sortOrder,
    } = filters;

    const orderColumn = this.resolveSortColumn(sortBy);
    const orderDirection: PersonSortOrder =
      sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const queryBuilder = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'position')
      .leftJoinAndSelect('person.mentor', 'mentor')
      .leftJoinAndSelect('person.managedBy', 'managedBy');

    if (search) {
      queryBuilder.andWhere(
        '(unaccent(person.alias) ILIKE unaccent(:search) OR unaccent(person.name) ILIKE unaccent(:search) OR unaccent(person.firstSurname) ILIKE unaccent(:search) OR unaccent(person.secondSurname) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    if (positionIds && positionIds.length > 0) {
      queryBuilder.andWhere((qb) => {
        const subQuery = qb
          .subQuery()
          .select('sub_person.id')
          .from(Person, 'sub_person')
          .innerJoin('sub_person.positions', 'sub_position')
          .where('sub_position.id IN (:...positionIds)')
          .getQuery();
        return 'person.id IN ' + subQuery;
      });
      queryBuilder.setParameter('positionIds', positionIds);
    }

    if (availability !== undefined) {
      queryBuilder.andWhere('person.availability = :availability', {
        availability,
      });
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

    if (isProvisional !== undefined) {
      queryBuilder.andWhere('person.isProvisional = :isProvisional', {
        isProvisional,
      });
    }

    const total = await queryBuilder.getCount();

    const data = await queryBuilder
      .orderBy(orderColumn, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    const responseData = plainToInstance(PersonResponseDto, data, {
      excludeExtraneousValues: true,
    });

    return { data: responseData, total };
  }

  /**
   * Whitelist-only mapping from validated `sortBy` to SQL column path.
   */
  private resolveSortColumn(sortBy: PersonSortByField | undefined): string {
    if (!sortBy) {
      return PERSON_SORT_COLUMN_MAP.alias;
    }
    return PERSON_SORT_COLUMN_MAP[sortBy] ?? PERSON_SORT_COLUMN_MAP.alias;
  }

  /** Retorna una persona per ID incloent posicions, mentor i gestor. Llança NotFoundException si no existeix. */
  async findOne(id: string): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor', 'managedBy', 'managedBy.person'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    return plainToInstance(PersonResponseDto, person, {
      excludeExtraneousValues: true,
    });
  }

  /** Crea una nova persona amb les posicions i mentor indicats. */
  async create(createPersonDto: CreatePersonDto): Promise<PersonResponseDto> {
    const { positionIds, mentorId, ...personData } = createPersonDto;

    const person = this.personRepository.create(personData);

    if (positionIds && positionIds.length > 0) {
      person.positions = await this.positionRepository.findByIds(positionIds);
    }

    if (mentorId) {
      const mentor = await this.personRepository.findOne({
        where: { id: mentorId },
      });
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

  /**
   * Creates a provisional person with only an alias.
   * The alias is automatically prefixed with "~" to avoid collisions with regular persons.
   * Provisional persons appear in attendance but are excluded from the default census view.
   */
  async createProvisional(alias: string): Promise<PersonResponseDto> {
    const provisionalAlias = `${PROVISIONAL_PREFIX}${alias}`.slice(
      0,
      MAX_ALIAS_LENGTH,
    );

    const existing = await this.personRepository.findOne({
      where: { alias: provisionalAlias },
    });
    if (existing) {
      throw new ConflictException(
        `Ja existeix una persona provisional amb l'àlies "${alias}". Prova amb un altre.`,
      );
    }

    const person = this.personRepository.create({
      alias: provisionalAlias,
      name: alias,
      firstSurname: '',
      isProvisional: true,
      isActive: true,
    });

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  /**
   * Actualitza una persona. Gestiona les transicions d'estat provisional:
   * - Promoció (provisional→regular): valida que `name`, `firstSurname` no estiguin buits i l'àlies no tingui prefix `~`.
   * - Democió (regular→provisional): afegeix el prefix `~` a l'àlies automàticament.
   */
  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
  ): Promise<PersonResponseDto> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    const { positionIds, mentorId, isProvisional, managedById, ...personData } =
      updatePersonDto;

    // Handle isProvisional transitions
    if (isProvisional !== undefined) {
      if (isProvisional === false && person.isProvisional === true) {
        // Promotion: validate required fields are set
        const name = personData.name ?? person.name;
        const firstSurname = personData.firstSurname ?? person.firstSurname;
        const alias = personData.alias ?? person.alias;

        if (!name || name.trim() === '') {
          throw new BadRequestException(
            'Cal proporcionar un nom per promoure una persona provisional',
          );
        }
        if (!firstSurname || firstSurname.trim() === '') {
          throw new BadRequestException(
            'Cal proporcionar un cognom per promoure una persona provisional',
          );
        }
        if (alias.startsWith(PROVISIONAL_PREFIX)) {
          throw new BadRequestException(
            'Cal proporcionar un àlies definitiu (sense el prefix ~) per promoure una persona provisional',
          );
        }
        if (!person.managedBy) {
          throw new BadRequestException(
            'Cal proporcionar un usuari per promoure una persona provisional',
          );
        }
      }

      if (isProvisional === true && person.isProvisional === false) {
        // Demotion: auto-prefix alias with ~ if not already prefixed
        const currentAlias = personData.alias ?? person.alias;
        if (!currentAlias.startsWith(PROVISIONAL_PREFIX)) {
          const prefixed = `${PROVISIONAL_PREFIX}${currentAlias}`.slice(
            0,
            MAX_ALIAS_LENGTH,
          );
          personData.alias = prefixed;
        }
      }

      person.isProvisional = isProvisional;
    }

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
        const mentor = await this.personRepository.findOne({
          where: { id: mentorId },
        });
        if (!mentor) {
          throw new NotFoundException(`Mentor with ID ${mentorId} not found`);
        }
        person.mentor = mentor;
      } else {
        person.mentor = null;
      }
    }

    if (managedById !== undefined) {
      if (managedById) {
        const user = await this.userRepository.findOne({
          where: { id: managedById },
        });
        if (!user) {
          throw new NotFoundException(`User with ID ${managedById} not found`);
        }
        person.managedBy = user;
      } else {
        person.managedBy = null;
      }
    }

    const saved = await this.personRepository.save(person);
    return plainToInstance(PersonResponseDto, saved, {
      excludeExtraneousValues: true,
    });
  }

  /** Soft delete: marca la persona com a inactiva (`isActive = false`) sense eliminar-la de la DB. */
  async softDelete(id: string): Promise<void> {
    const person = await this.personRepository.findOne({ where: { id } });
    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }
    person.isActive = false;
    await this.personRepository.save(person);
  }

  /** Desactiva una persona i actualitza `lastSyncedAt`. Equivalent al soft delete però retorna el DTO actualitzat. */
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

  /** Reactiva una persona prèviament desactivada i actualitza `lastSyncedAt`. */
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
