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
  AttendanceResponse,
  ManagedPerson,
  ManagedPersonAttendance,
  PendingDependent,
} from '@muixer/shared';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { ProjectionService, ProjectionData } from '../event-segment/projection.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { getLocalToday } from '../../common/utils/date.util';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { PersonService } from '../person/person.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';
import { DependentRegistrationDto } from './dto/dependent-registration.dto';

const PROVISIONAL_ALIAS_PREFIX = '~';

@Injectable()
export class MeService {
  private readonly logger = new Logger(MeService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    private readonly seasonService: SeasonService,
    private readonly attendanceService: AttendanceService,
    private readonly personDelegateService: PersonDelegateService,
    private readonly personService: PersonService,
    private readonly projectionService: ProjectionService,
    private readonly eventSegmentService: EventSegmentService,
  ) {}

  async resolveManagedPersons(userId: string): Promise<ManagedPerson[]> {
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

    const delegates = await this.personDelegateService.findByUser(userId);
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

  async findEventSegments(eventId: string): Promise<MeSegment[]> {
    const segments = await this.eventSegmentService.findAllByEvent(eventId);

    return segments
      .filter((segment) => segment.isPublished)
      .map((segment) => ({
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
      }));
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
