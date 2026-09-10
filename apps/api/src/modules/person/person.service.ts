import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsSelect, In, Repository } from 'typeorm';
import { Person } from './person.entity';
import { CreatePersonDto } from './dto/create-person.dto';
import { UpdatePersonDto } from './dto/update-person.dto';
import { PersonFilterDto } from './dto/person-filter.dto';
import { Tag } from '../tag/tag.entity';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import {
  PERSON_SORT_COLUMN_MAP,
  type PersonSortByField,
  type PersonSortOrder,
} from './constants/person-sort.constants';
import { applyTagRuleFilter } from './utils/tag-rule-filter.util';
import { TagCategory, UserRole } from '@muixer/shared';

const PROVISIONAL_PREFIX = '~';
const MAX_ALIAS_LENGTH = 20;
const DEFAULT_TAG_SLUG = 'persona-nova';
const TECHNICAL_SORT_FIELDS = new Set<PersonSortByField>(['alias', 'name']);

const TECHNICAL_DIRECTORY_SELECT = [
  'person.id',
  'person.name',
  'person.alias',
  'position.id',
  'position.name',
  'position.slug',
  'position.color',
  'position.category',
  'position.positionTypes',
];

const ADMIN_LIST_SELECT = [
  'person.id',
  'person.name',
  'person.firstSurname',
  'person.secondSurname',
  'person.alias',
  'person.phone',
  'person.birthDate',
  'person.shoulderHeight',
  'person.gender',
  'person.isXicalla',
  'person.isActive',
  'person.isMember',
  'person.isProvisional',
  'person.availability',
  'person.onboardingStatus',
  'person.notes',
  'person.notesEmoji',
  'person.shirtDate',
  'person.createdAt',
  'person.updatedAt',
  ...TECHNICAL_DIRECTORY_SELECT.slice(3),
  'user.id',
  'user.email',
  'user.isActive',
];

const OPERATIONAL_DETAIL_SELECT: FindOptionsSelect<Person> = {
  id: true,
  name: true,
  alias: true,
  shoulderHeight: true,
  isXicalla: true,
  isActive: true,
  isMember: true,
  isProvisional: true,
  availability: true,
  onboardingStatus: true,
  notes: true,
  notesEmoji: true,
  shirtDate: true,
  positions: {
    id: true,
    name: true,
    slug: true,
    color: true,
    category: true,
    positionTypes: true,
  },
  user: {
    isActive: true,
  },
};

const ADMIN_DETAIL_SELECT: FindOptionsSelect<Person> = {
  ...OPERATIONAL_DETAIL_SELECT,
  firstSurname: true,
  secondSurname: true,
  phone: true,
  birthDate: true,
  gender: true,
  createdAt: true,
  updatedAt: true,
  user: {
    id: true,
    email: true,
    isActive: true,
  },
};

/** La temporada que conté el dia d'avui; la més recent si n'hi haguera de solapades. */
const CURRENT_SEASON_SUBQUERY = `(
  SELECT s.id FROM seasons s
  WHERE s."startDate" <= CURRENT_DATE AND s."endDate" >= CURRENT_DATE
  ORDER BY s."startDate" DESC LIMIT 1
)`;

/**
 * Assistències confirmades de la temporada en curs: és la senyal que fa visibles les persones
 * noves que ja venen recurrentment però encara no tenen posició assignada. `$1` és la llista
 * d'ids de la pàgina carregada.
 */
const ATTENDED_COUNT_QUERY = `SELECT a."personId" AS "personId", COUNT(*)::int AS count
   FROM attendances a
   JOIN events e ON e.id = a."eventId"
   WHERE a."personId" = ANY($1::uuid[])
     AND a.status = 'ASSISTIT'
     AND e."seasonId" = ${CURRENT_SEASON_SUBQUERY}
   GROUP BY a."personId"`;

/** La mateixa xifra com a expressió correlada, per poder-hi ordenar dins la consulta paginada. */
const ATTENDED_COUNT_EXPRESSION = `(SELECT COUNT(*)::int FROM attendances a
   JOIN events e ON e.id = a."eventId"
   WHERE a."personId" = person.id
     AND a.status = 'ASSISTIT'
     AND e."seasonId" = ${CURRENT_SEASON_SUBQUERY})`;

@Injectable()
export class PersonService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Tag)
    private readonly positionRepository: Repository<Tag>,
    private readonly personDelegateService: PersonDelegateService,
  ) {}

  /** Retorna una llista paginada i ordenada de persones aplicant tots els filtres disponibles. Usa `unaccent` per cerques insensibles a accents. */
  async findAll(
    filters: PersonFilterDto,
    role: UserRole,
  ): Promise<{ data: Person[]; total: number }> {
    const {
      search,
      positionIds,
      tagRuleOk,
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

    if (
      role === UserRole.TECHNICAL &&
      sortBy !== undefined &&
      !TECHNICAL_SORT_FIELDS.has(sortBy)
    ) {
      throw new ForbiddenException(
        'No teniu permís per ordenar per aquest camp',
      );
    }

    const orderColumn = this.resolveSortColumn(sortBy);
    const orderDirection: PersonSortOrder =
      sortOrder === 'DESC' ? 'DESC' : 'ASC';

    const queryBuilder = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'position')
      .select(
        role === UserRole.TECHNICAL
          ? TECHNICAL_DIRECTORY_SELECT
          : ADMIN_LIST_SELECT,
      );
    if (role === UserRole.ADMIN) {
      queryBuilder.leftJoinAndSelect('person.user', 'user');
    }

    if (search) {
      const searchFields =
        role === UserRole.TECHNICAL
          ? '(unaccent(person.alias) ILIKE unaccent(:search) OR unaccent(person.name) ILIKE unaccent(:search))'
          : '(unaccent(person.alias) ILIKE unaccent(:search) OR unaccent(person.name) ILIKE unaccent(:search) OR unaccent(person.firstSurname) ILIKE unaccent(:search) OR unaccent(person.secondSurname) ILIKE unaccent(:search))';
      queryBuilder.andWhere(searchFields, { search: `%${search}%` });
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

    if (tagRuleOk !== undefined) {
      applyTagRuleFilter(queryBuilder, 'person', tagRuleOk);
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

    if (role === UserRole.ADMIN && sortBy === 'attendedCount') {
      // Només quan cal ordenar-hi: TypeORM necessita l'expressió com a columna seleccionada
      // per poder-la referenciar des de la seua consulta de paginació amb joins.
      queryBuilder.addSelect(ATTENDED_COUNT_EXPRESSION, 'attended_count');
    }

    const data = await queryBuilder
      .orderBy(orderColumn, orderDirection)
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    // Assistències de la temporada en curs, resoltes només per a la pàgina carregada: unir-les
    // a la consulta paginada multiplicaria les files contra `person.positions`.
    if (role === UserRole.ADMIN) {
      const attendedCounts = await this.loadAttendedCounts(
        data.map((person) => person.id),
      );
      for (const person of data) {
        (person as Person & { attendedCount: number }).attendedCount =
          attendedCounts.get(person.id) ?? 0;
      }
    }

    return { data, total };
  }

  private async loadAttendedCounts(personIds: string[]): Promise<Map<string, number>> {
    if (personIds.length === 0) return new Map();

    const rows: { personId: string; count: number }[] =
      await this.personRepository.query(ATTENDED_COUNT_QUERY, [personIds]);

    return new Map(rows.map((row) => [row.personId, row.count]));
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

  /** Resolves position ids to `Tag` entities, throwing if any id doesn't exist instead of silently dropping it. */
  private async findPositionsOrThrow(positionIds: string[]): Promise<Tag[]> {
    const positions = await this.positionRepository.findBy({
      id: In(positionIds),
    });
    if (positions.length !== positionIds.length) {
      throw new NotFoundException(
        'One or more positions were not found',
      );
    }
    return positions;
  }

  /** Retorna una persona per ID incloent posicions, mentor i gestor. Llança NotFoundException si no existeix. */
  async findOne(
    id: string,
    role: UserRole,
  ): Promise<Person> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: { positions: true, user: true },
      select:
        role === UserRole.TECHNICAL
          ? OPERATIONAL_DETAIL_SELECT
          : ADMIN_DETAIL_SELECT,
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    return person;
  }

  /** Crea una nova persona amb les posicions i mentor indicats. */
  async create(createPersonDto: CreatePersonDto): Promise<Person> {
    const { positionIds, mentorId, ...personData } = createPersonDto;

    const person = this.personRepository.create(personData);

    if (positionIds && positionIds.length > 0) {
      person.positions = await this.findPositionsOrThrow(positionIds);
    }

    // Regla mínima d'etiquetatge: qui no és de xicalla ni d'«altres» entra com a persona nova,
    // perquè la tècnica puga fer-ne el seguiment fins que se li puga assignar una posició.
    const categories = (person.positions ?? []).map((tag) => tag.category);
    const needsDefault =
      !categories.includes(TagCategory.XICALLA) && !categories.includes(TagCategory.ALTRES);

    if (needsDefault) {
      const defaultTag = await this.positionRepository.findOne({
        where: { slug: DEFAULT_TAG_SLUG },
      });
      if (defaultTag) {
        person.positions = [...(person.positions ?? []), defaultTag];
      }
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

    return this.personRepository.save(person);
  }

  /**
   * Creates a provisional person with only an alias.
   * The alias is automatically prefixed with "~" to avoid collisions with regular persons.
   * Provisional persons appear in attendance but are excluded from the default census view.
   */
  async createProvisional(alias: string): Promise<Person> {
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

    return this.personRepository.save(person);
  }

  /**
   * Actualitza una persona. Gestiona les transicions d'estat provisional:
   * - Promoció (provisional→regular): valida que `name`, `firstSurname` no estiguin buits i l'àlies no tingui prefix `~`.
   * - Democió (regular→provisional): afegeix el prefix `~` a l'àlies automàticament.
   *
   * Accepta un `manager` opcional perquè un caller (p. ex. `AuthService.registerViaInvite`) pugui
   * incloure aquesta escriptura dins la seva pròpia transacció — quan s'omet, usa el repositori
   * injectat com sempre.
   */
  async update(
    id: string,
    updatePersonDto: UpdatePersonDto,
    manager?: EntityManager,
  ): Promise<Person> {
    const personRepository = manager
      ? manager.getRepository(Person)
      : this.personRepository;

    const person = await personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor', 'user'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    const { positionIds, mentorId, isProvisional, ...personData } =
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
        if (!person.user) {
          const primaryDelegate = await this.personDelegateService.getPrimary(person.id);
          if (!primaryDelegate) {
            throw new BadRequestException(
              'Cal proporcionar un usuari per promoure una persona provisional',
            );
          }
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

    if (personData.isXicalla === true && person.isXicalla === false) {
      await this.personDelegateService.assertPrimaryQualifiesForXicalla(person.id);
    }

    if (personData.alias !== undefined && personData.alias !== person.alias) {
      const conflict = await personRepository.findOne({
        where: { alias: personData.alias },
      });
      if (conflict && conflict.id !== person.id) {
        throw new ConflictException(
          `Ja existeix una persona amb l'àlies "${personData.alias}". Contacteu amb l'administrador per canviar-lo.`,
        );
      }
    }

    Object.assign(person, personData);

    if (positionIds !== undefined) {
      if (positionIds.length > 0) {
        person.positions = await this.findPositionsOrThrow(positionIds);
      } else {
        person.positions = [];
      }
    }

    if (mentorId !== undefined) {
      if (mentorId) {
        const mentor = await personRepository.findOne({
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

    return personRepository.save(person);
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

  /** Reactiva una persona prèviament desactivada manualment. */
  async activate(id: string): Promise<Person> {
    const person = await this.personRepository.findOne({
      where: { id },
      relations: ['positions', 'mentor', 'user'],
    });

    if (!person) {
      throw new NotFoundException(`Person with ID ${id} not found`);
    }

    person.isActive = true;

    return this.personRepository.save(person);
  }
}
