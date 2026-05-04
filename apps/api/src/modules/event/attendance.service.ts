import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceStatus, AttendanceSummary } from '@muixer/shared';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { Person } from '../person/person.entity';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
  ) {}

  /** Retorna una llista paginada d'assistències per a un event concret amb filtres per estat i cerca de persona. */
  async findByEvent(
    eventId: string,
    filters: AttendanceFilterDto,
  ): Promise<{ data: AttendanceItem[]; total: number }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const { status, search, page = 1, limit = 100 } = filters;

    const qb = this.attendanceRepository
      .createQueryBuilder('attendance')
      .leftJoinAndSelect('attendance.person', 'person')
      .leftJoinAndSelect('person.positions', 'position')
      .where('attendance.event = :eventId', { eventId });

    if (status) {
      qb.andWhere('attendance.status = :status', { status });
    }

    if (search) {
      qb.andWhere(
        '(unaccent(person.alias) ILIKE unaccent(:search) OR unaccent(person.name) ILIKE unaccent(:search) OR unaccent(person.firstSurname) ILIKE unaccent(:search))',
        { search: `%${search}%` },
      );
    }

    const total = await qb.getCount();

    const attendances = await qb
      .orderBy('person.alias', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    return { data: attendances.map(toAttendanceItem), total };
  }

  /** Crea un registre d'assistència per a un event i una persona. Llança ConflictException si ja existeix. Recalcula el summary de l'event. */
  async create(
    eventId: string,
    dto: CreateAttendanceDto,
  ): Promise<{ attendance: AttendanceItem; summary: AttendanceSummary }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const person = await this.personRepository.findOne({
      where: { id: dto.personId },
      relations: ['positions'],
    });
    if (!person) {
      throw new NotFoundException(`Person with ID ${dto.personId} not found`);
    }

    const existing = await this.attendanceRepository.findOne({
      where: { event: { id: eventId }, person: { id: dto.personId } },
    });
    if (existing) {
      throw new ConflictException('Aquesta persona ja té registre d\'assistència per aquest event');
    }

    const attendance = this.attendanceRepository.create({
      status: dto.status,
      notes: dto.notes ?? null,
      respondedAt: new Date(),
      event,
      person,
    });

    const saved = await this.attendanceRepository.save(attendance);
    const savedWithRelations = await this.attendanceRepository.findOne({
      where: { id: saved.id },
      relations: ['person', 'person.positions'],
    });

    await this.recalculateSummary(eventId);
    const summary = await this.fetchSummary(eventId);

    return { attendance: toAttendanceItem(savedWithRelations!), summary };
  }

  /** Actualitza l'estat i/o notes d'un registre d'assistència. Recalcula el summary de l'event. */
  async update(
    eventId: string,
    attendanceId: string,
    dto: UpdateAttendanceDto,
  ): Promise<{ attendance: AttendanceItem; summary: AttendanceSummary }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId, event: { id: eventId } },
      relations: ['person', 'person.positions'],
    });
    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${attendanceId} not found`);
    }

    if (dto.status !== undefined) attendance.status = dto.status;
    if (dto.notes !== undefined) attendance.notes = dto.notes;
    attendance.respondedAt = new Date();

    const saved = await this.attendanceRepository.save(attendance);
    const savedWithRelations = await this.attendanceRepository.findOne({
      where: { id: saved.id },
      relations: ['person', 'person.positions'],
    });

    await this.recalculateSummary(eventId);
    const summary = await this.fetchSummary(eventId);

    return { attendance: toAttendanceItem(savedWithRelations!), summary };
  }

  /** Elimina un registre d'assistència i recalcula el summary de l'event. */
  async remove(
    eventId: string,
    attendanceId: string,
  ): Promise<{ summary: AttendanceSummary }> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const attendance = await this.attendanceRepository.findOne({
      where: { id: attendanceId, event: { id: eventId } },
    });
    if (!attendance) {
      throw new NotFoundException(`Attendance with ID ${attendanceId} not found`);
    }

    await this.attendanceRepository.remove(attendance);
    await this.recalculateSummary(eventId);
    const summary = await this.fetchSummary(eventId);

    return { summary };
  }

  /** Recalcula i desa el `attendanceSummary` de l'event a partir dels registres d'assistència actuals. S'executa a cada operació CRUD d'assistència. */
  async recalculateSummary(eventId: string): Promise<void> {
    const attendances = await this.attendanceRepository.find({
      where: { event: { id: eventId } },
      relations: ['person'],
    });

    const summary = {
      confirmed: attendances.filter((a) => a.status === AttendanceStatus.ANIRE).length,
      declined: attendances.filter((a) => a.status === AttendanceStatus.NO_VAIG).length,
      pending: attendances.filter((a) => a.status === AttendanceStatus.PENDENT).length,
      attended: attendances.filter((a) => a.status === AttendanceStatus.ASSISTIT).length,
      noShow: attendances.filter((a) => a.status === AttendanceStatus.NO_PRESENTAT).length,
      lateCancel: 0,
      children: attendances.filter(
        (a) =>
          [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT].includes(a.status) &&
          a.person.isXicalla,
      ).length,
      total: attendances.length,
    };

    await this.eventRepository.update(eventId, { attendanceSummary: summary });
  }

  /** Carrega el `attendanceSummary` actualitzat de la DB per retornar-lo immediatament al client. */
  private async fetchSummary(eventId: string): Promise<AttendanceSummary> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId },
      select: ['attendanceSummary'],
    });
    return event!.attendanceSummary;
  }
}

export interface AttendancePersonRef {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  isXicalla: boolean;
  positions: { id: string; name: string; color: string | null }[];
}

export interface AttendanceItem {
  id: string;
  status: AttendanceStatus;
  respondedAt: Date | null;
  notes: string | null;
  person: AttendancePersonRef;
}

function toAttendanceItem(a: Attendance): AttendanceItem {
  return {
    id: a.id,
    status: a.status,
    respondedAt: a.respondedAt,
    notes: a.notes,
    person: {
      id: a.person.id,
      alias: a.person.alias,
      name: a.person.name,
      firstSurname: a.person.firstSurname,
      isXicalla: a.person.isXicalla,
      positions: (a.person.positions ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
      })),
    },
  };
}
