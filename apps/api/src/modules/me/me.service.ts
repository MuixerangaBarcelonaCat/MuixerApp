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
  AttendanceStatus,
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  AttendanceResponse,
  ManagedPerson,
  ManagedPersonAttendance,
} from '@muixer/shared';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { getLocalToday } from '../../common/utils/date.util';
import { SeasonService } from '../season/season.service';
import { AttendanceService } from '../event/attendance.service';
import { PersonDelegateService } from '../person-delegate/person-delegate.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';

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
        displayName: `${user.person.name} ${user.person.firstSurname}`,
        isSelf: true,
        delegateType: null,
      });
    }

    const delegates = await this.personDelegateService.findByUser(userId);
    for (const delegate of delegates) {
      managed.push({
        personId: delegate.person.id,
        displayName: `${delegate.person.name} ${delegate.person.firstSurname}`,
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
    const personId = await this.resolvePersonId(jwtUser.sub);
    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    if (managedPersons.length === 0) return this.emptyPage(filters);

    const season = await this.seasonService.findCurrentEntity();
    if (!season) return this.emptyPage(filters);

    const { type, timeFilter = 'upcoming', page = 1, limit = 20 } = filters;

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .leftJoin(
        Attendance,
        'att',
        'att."eventId" = event.id AND att."personId" = :personId',
        { personId },
      )
      .addSelect('att.id', 'att_id')
      .addSelect('att.status', 'att_status')
      .addSelect('att.respondedAt', 'att_respondedAt')
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

    const rawResults = await qb
      .offset((page - 1) * limit)
      .limit(limit)
      .getRawAndEntities();

    const data: MeEvent[] = rawResults.entities.map((event, i) => {
      const raw = rawResults.raw[i];
      return this.toMeEvent(event, raw);
    });

    return { data, meta: { total, page, limit } };
  }

  async findEventDetail(
    jwtUser: JwtPayload,
    eventId: string,
  ): Promise<MeEventDetail> {
    const personId = await this.resolvePersonId(jwtUser.sub);

    const qb = this.eventRepository
      .createQueryBuilder('event')
      .where('event.id = :eventId', { eventId });

    if (personId) {
      qb.leftJoin(
        Attendance,
        'att',
        'att."eventId" = event.id AND att."personId" = :personId',
        { personId },
      )
        .addSelect('att.id', 'att_id')
        .addSelect('att.status', 'att_status')
        .addSelect('att.respondedAt', 'att_respondedAt');
    }

    const result = await qb.getRawAndEntities();
    const event = result.entities[0];
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const raw = result.raw[0];
    const managedPersons = await this.resolveManagedPersons(jwtUser.sub);
    const managedAttendances = await this.buildManagedAttendances(eventId, managedPersons);
    return { ...this.toMeEventDetail(event, raw), managedAttendances };
  }

  private async buildManagedAttendances(
    eventId: string,
    managedPersons: ManagedPerson[],
  ): Promise<ManagedPersonAttendance[]> {
    if (managedPersons.length === 0) return [];

    const attendances = await this.attendanceRepository.find({
      where: { event: { id: eventId }, person: { id: In(managedPersons.map((p) => p.personId)) } },
      relations: ['person'],
    });

    return managedPersons.map((managedPerson) => {
      const attendance = attendances.find((a) => a.person.id === managedPerson.personId);
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
    });
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



  private async resolvePersonId(userId: string): Promise<string | null> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: ['person'],
    });
    return user?.person?.id ?? null;
  }

  private emptyPage(filters: MeEventFilterDto): PaginatedResponse<MeEvent> {
    return {
      data: [],
      meta: { total: 0, page: filters.page ?? 1, limit: filters.limit ?? 20 },
    };
  }

  private toMeEvent(event: Event, raw: Record<string, unknown>): MeEvent {
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
      myAttendance: raw['att_id']
        ? {
            id: raw['att_id'] as string,
            status: raw['att_status'] as AttendanceStatus,
            respondedAt: raw['att_respondedAt']
              ? (raw['att_respondedAt'] as Date).toISOString()
              : null,
          }
        : null,
    };
  }

  private toMeEventDetail(
    event: Event,
    raw: Record<string, unknown>,
  ): Omit<MeEventDetail, 'managedAttendances'> {
    return {
      ...this.toMeEvent(event, raw),
      description: event.description,
      locationUrl: event.locationUrl,
      information: event.information,
    };
  }
}
