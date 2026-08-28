import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  JwtPayload,
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  MeSegment,
  MeSegmentPlacement,
  AttendanceResponse,
  ManagedPerson,
  ManagedPersonAttendance,
  PendingDependent,
  PersonProfileSummary,
  MeNewsItem,
  UserRole,
} from '@muixer/shared';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { ProjectionService, ProjectionData } from '../event-segment/projection.service';
import { EventSegmentService, SegmentWithInstances } from '../event-segment/event-segment.service';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { PersonDelegate } from '../person-delegate/person-delegate.entity';
import { News } from '../news/news.entity';
import { getLocalToday } from '../../common/utils/date.util';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PersonService } from '../person/person.service';
import { NewsService } from '../news/news.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';
import { DependentRegistrationDto } from './dto/dependent-registration.dto';
import { CreateMemberDelegateDto } from './dto/create-member-delegate.dto';

const PROVISIONAL_ALIAS_PREFIX = '~';

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(NodeAssignment)
    private readonly nodeAssignmentRepository: Repository<NodeAssignment>,
    private readonly seasonService: SeasonService,
    private readonly attendanceService: AttendanceService,
    private readonly personDelegateService: PersonDelegateService,
    private readonly personService: PersonService,
    private readonly projectionService: ProjectionService,
    private readonly eventSegmentService: EventSegmentService,
    private readonly newsService: NewsService,
  ) {}

  async resolveManagedPersons(
    userId: string,
    options?: { primaryOnly?: boolean },
  ): Promise<ManagedPerson[]> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });

    const managed: ManagedPerson[] = [];
    if (user?.person) {
      managed.push({
        personId: user.person.id,
        displayName: user.person.alias,
        isSelf: true,
        delegateType: null,
      });
    }

    const delegates = await this.personDelegateService.findByUser(userId, options);
    for (const delegate of delegates) {
      managed.push({
        personId: delegate.person.id,
        displayName: delegate.person.alias,
        isSelf: false,
        delegateType: delegate.delegateType,
      });
    }

    return managed;
  }

  async findEvents(
    jwtUser: JwtPayload,
    filters: MeEventFilterDto,
  ): Promise<PaginatedResponse<MeEvent>> {
    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    if (managedPersons.length === 0) return this.emptyPage(filters);

    const season = await this.seasonService.findCurrentEntity();
    if (!season) return this.emptyPage(filters);

    const { type, timeFilter = 'upcoming', page = 1, limit = 20 } = filters;

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event."seasonId" = :seasonId', { seasonId: season.id });

    if (type) {
      qb.andWhere('event."eventType" = :type', { type });
    }

    const today = getLocalToday();
    if (timeFilter === 'upcoming') {
      qb.andWhere('event.date >= :today', { today });
      qb.orderBy('event.date', 'ASC').addOrderBy('event."startTime"', 'ASC');
    } else if (timeFilter === 'past') {
      qb.andWhere('event.date < :today', { today });
      qb.orderBy('event.date', 'DESC').addOrderBy('event."startTime"', 'DESC');
    } else {
      qb.orderBy('event.date', 'ASC').addOrderBy('event."startTime"', 'ASC');
    }

    const total = await qb.getCount();

    const events = await qb.offset((page - 1) * limit).limit(limit).getMany();

    const attendancesByEvent = await this.fetchAttendancesByEvent(
      events.map((event) => event.id),
      managedPersons,
    );

    const data: MeEvent[] = events.map((event) =>
      this.toMeEvent(event, attendancesByEvent.get(event.id) ?? []),
    );

    return { data, meta: { total, page, limit } };
  }

  async findEventDetail(
    jwtUser: JwtPayload,
    eventId: string,
  ): Promise<MeEventDetail> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    const attendancesByEvent = await this.fetchAttendancesByEvent([eventId], managedPersons);

    return {
      ...this.toMeEvent(event, attendancesByEvent.get(eventId) ?? []),
      description: event.description,
      locationUrl: event.locationUrl,
      information: event.information,
    };
  }

  async findEventSegments(
    jwtUser: JwtPayload,
    eventId: string,
    requestedPersonId?: string,
  ): Promise<MeSegment[]> {
    const segments = await this.eventSegmentService.findAllByEvent(eventId);
    const published = segments.filter((segment) => segment.isPublished);

    const personId = await this.resolveTargetPersonId(jwtUser, requestedPersonId);
    const placementsBySegment = await this.fetchOwnPlacementsBySegment(personId, published);

    return published.map((segment) => ({
      id: segment.id,
      name: segment.name,
      sortOrder: segment.sortOrder,
      instances: segment.instances.map((instance) => ({
        label: instance.label,
        figureMode: instance.figureMode,
        figureTemplate: instance.figureTemplate
          ? { name: instance.figureTemplate.name, hasPinya: instance.figureTemplate.hasPinya }
          : null,
      })),
      myPlacements: placementsBySegment.get(segment.id) ?? [],
    }));
  }

  /**
   * Resolves which person's placements to show: the caller's own person when no `requestedPersonId`
   * is given; any person for TECHNICAL/ADMIN; only the caller's own managed persons (self + delegates)
   * for MEMBER — otherwise 403, so a member can't view an arbitrary person by editing the URL.
   */
  private async resolveTargetPersonId(
    jwtUser: JwtPayload,
    requestedPersonId?: string,
  ): Promise<string | null> {
    if (!requestedPersonId) {
      const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
      return managedPersons.find((p) => p.isSelf)?.personId ?? null;
    }

    if (jwtUser.role === UserRole.TECHNICAL || jwtUser.role === UserRole.ADMIN) {
      return requestedPersonId;
    }

    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    const isManaged = managedPersons.some((p) => p.personId === requestedPersonId);
    if (!isManaged) {
      throw new ForbiddenException('No autoritzat per consultar esta persona');
    }
    return requestedPersonId;
  }

  /**
   * The caller's own assignments across `segments` — person derived from the JWT, never from a
   * query param. Reads `NodeAssignment` directly (rather than `ProjectionService.getProjection`,
   * which snapshots nodes+assignments per segment for the canvas) since a list of raw label/cordon
   * pairs across every published segment of the event doesn't need that per-node canvas shape.
   */
  private async fetchOwnPlacementsBySegment(
    personId: string | null,
    segments: SegmentWithInstances[],
  ): Promise<Map<string, MeSegmentPlacement[]>> {
    const bySegment = new Map<string, MeSegmentPlacement[]>();
    if (!personId || segments.length === 0) return bySegment;

    const assignments = await this.nodeAssignmentRepository.find({
      where: { segment: { id: In(segments.map((s) => s.id)) }, person: { id: personId } },
      relations: ['instanceNode', 'figureInstance', 'figureInstance.figureTemplate', 'segment'],
    });

    const instanceCountBySegment = new Map(segments.map((s) => [s.id, s.instances.length]));

    for (const assignment of assignments) {
      const segmentId = assignment.segment.id;
      const instance = assignment.figureInstance;
      const node = assignment.instanceNode;
      const figureName =
        (instanceCountBySegment.get(segmentId) ?? 0) > 1
          ? instance.label ?? instance.figureTemplate?.name ?? null
          : null;

      const placement: MeSegmentPlacement = {
        nodeLabel: node.label,
        cordon: node.renglaPosition,
        figureName,
        figureMode: instance.figureMode,
      };

      const list = bySegment.get(segmentId) ?? [];
      list.push(placement);
      bySegment.set(segmentId, list);
    }

    return bySegment;
  }

  findSegmentProjection(eventId: string, segmentId: string): Promise<ProjectionData> {
    return this.projectionService.getProjection(eventId, segmentId, { onlyPublished: true });
  }

  private async fetchAttendancesByEvent(
    eventIds: string[],
    managedPersons: ManagedPerson[],
  ): Promise<Map<string, ManagedPersonAttendance[]>> {
    const attendancesByEvent = new Map<string, ManagedPersonAttendance[]>();
    if (eventIds.length === 0 || managedPersons.length === 0) return attendancesByEvent;

    const attendances = await this.attendanceRepository.find({
      where: {
        event: { id: In(eventIds) },
        person: { id: In(managedPersons.map((p) => p.personId)) },
      },
      relations: ['person', 'event'],
    });

    for (const eventId of eventIds) {
      attendancesByEvent.set(
        eventId,
        managedPersons.map((managedPerson) => {
          const attendance = attendances.find(
            (a) => a.event.id === eventId && a.person.id === managedPerson.personId,
          );
          return {
            ...managedPerson,
            attendance: attendance
              ? {
                  id: attendance.id,
                  status: attendance.status,
                  respondedAt: attendance.respondedAt ? attendance.respondedAt.toISOString() : null,
                }
              : null,
          };
        }),
      );
    }

    return attendancesByEvent;
  }

  async upsertAttendance(
    jwtUser: JwtPayload,
    eventId: string,
    dto: UpdateMyAttendanceDto,
  ): Promise<AttendanceResponse> {
    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    const personId = dto.personId ?? managedPersons.find((p) => p.isSelf)?.personId ?? null;
    if (!personId) {
      throw new ForbiddenException('No tens un perfil de persona associat al teu compte');
    }
    if (dto.personId && !managedPersons.some((p) => p.personId === dto.personId)) {
      throw new ForbiddenException("No pots gestionar l'assistència d'esta persona");
    }

    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const today = getLocalToday();
    const eventDate = event.date instanceof Date
      ? event.date.toISOString().slice(0, 10)
      : String(event.date);
    if (eventDate < today) {
      throw new BadRequestException('No es pot modificar l\'assistència d\'un event passat');
    }

    const now = new Date();

    await this.attendanceRepository.upsert(
      {
        person: { id: personId } as never,
        event: { id: eventId } as never,
        status: dto.status,
        respondedAt: now,
      },
      {
        conflictPaths: ['person', 'event'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    const attendance = await this.attendanceRepository.findOneOrFail({
      where: { person: { id: personId }, event: { id: eventId } },
    });

    await this.attendanceService.recalculateSummary(eventId);

    return {
      id: attendance.id,
      status: attendance.status,
      respondedAt: attendance.respondedAt!.toISOString(),
    };
  }



  /** Resum d'una persona gestionada (àlies, nom, nombre de delegacions actives) per a la capçalera del perfil. */
  async getPersonSummary(userId: string, personId: string): Promise<PersonProfileSummary> {
    await this.personDelegateService.assertCanManagePerson(userId, personId);

    const person = await this.personRepository.findOne({ where: { id: personId } });
    if (!person) {
      throw new NotFoundException(`Person #${personId} not found`);
    }

    const delegates = await this.personDelegateService.findByPerson(personId);

    return {
      personId: person.id,
      alias: person.alias,
      name: person.name,
      firstSurname: person.firstSurname,
      delegationCount: delegates.filter((d) => d.isActive).length,
    };
  }

  async listPersonDelegates(userId: string, personId: string): Promise<PersonDelegate[]> {
    await this.personDelegateService.assertCanManagePerson(userId, personId);
    return this.personDelegateService.findByPerson(personId);
  }

  async createPersonDelegate(
    userId: string,
    personId: string,
    dto: CreateMemberDelegateDto,
  ): Promise<PersonDelegate> {
    await this.personDelegateService.assertCanManagePerson(userId, personId);

    const targetPerson = await this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.user', 'user')
      .where('LOWER(person.alias) = LOWER(:alias)', { alias: dto.alias })
      .getOne();
    if (!targetPerson?.user) {
      throw new NotFoundException('No existeix cap compte associat a aquest àlies');
    }

    return this.personDelegateService.create(personId, {
      userId: targetPerson.user.id,
      delegateType: dto.delegateType,
      isPrimary: false,
    });
  }

  async removePersonDelegate(userId: string, personId: string, delegateId: string): Promise<void> {
    await this.personDelegateService.assertCanManagePerson(userId, personId);
    await this.personDelegateService.remove(personId, delegateId, { allowPrimaryRemoval: false });
  }

  async getPendingDependents(userId: string): Promise<PendingDependent[]> {
    const dependents = await this.personDelegateService.findProvisionalPrimaryDependents(userId);
    return dependents.map((person) => this.toPendingDependent(person));
  }

  async completePendingDependent(
    userId: string,
    dto: DependentRegistrationDto,
  ): Promise<void> {
    const eligible = await this.personDelegateService.findProvisionalPrimaryDependents(userId);
    const person = eligible.find((p) => p.id === dto.personId);
    if (!person) {
      throw new BadRequestException(
        'Esta persona no és un dependent pendent de completar per a este compte',
      );
    }

    const { personId, ...registrationData } = dto;
    const alias = person.alias.startsWith(PROVISIONAL_ALIAS_PREFIX)
      ? person.alias.slice(PROVISIONAL_ALIAS_PREFIX.length)
      : person.alias;

    await this.personService.update(personId, {
      ...registrationData,
      isProvisional: false,
      alias,
    });
  }

  private toPendingDependent(person: Person): PendingDependent {
    return {
      personId: person.id,
      alias: person.alias,
      name: person.name,
      firstSurname: person.firstSurname,
      secondSurname: person.secondSurname,
      gender: person.gender,
      phone: person.phone,
      birthDate: person.birthDate instanceof Date
        ? person.birthDate.toISOString().slice(0, 10)
        : (person.birthDate ?? null),
    };
  }

  async findNews(): Promise<MeNewsItem[]> {
    const newsItems = await this.newsService.findPublished();
    return newsItems.map((news) => this.toMeNewsItem(news));
  }

  async findNewsDetail(id: string): Promise<MeNewsItem> {
    const news = await this.newsService.findPublishedOne(id);
    return this.toMeNewsItem(news);
  }

  private toMeNewsItem(news: News): MeNewsItem {
    return {
      id: news.id,
      title: news.title,
      publishedAt: news.publishedAt!.toISOString(),
      body: news.body,
    };
  }

  private emptyPage(filters: MeEventFilterDto): PaginatedResponse<MeEvent> {
    return {
      data: [],
      meta: { total: 0, page: filters.page ?? 1, limit: filters.limit ?? 20 },
    };
  }

  private toMeEvent(event: Event, managedAttendances: ManagedPersonAttendance[]): MeEvent {
    return {
      id: event.id,
      eventType: event.eventType,
      title: event.title,
      date: event.date instanceof Date
        ? event.date.toISOString().slice(0, 10)
        : String(event.date),
      startTime: event.startTime,
      location: event.location,
      attendanceSummary: event.attendanceSummary,
      myAttendance: managedAttendances.find((m) => m.isSelf)?.attendance ?? null,
      managedAttendances,
    };
  }
}
