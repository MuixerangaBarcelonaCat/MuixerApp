import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceStatus } from '@muixer/shared';
import { Attendance } from './attendance.entity';
import { Event } from './event.entity';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
  ) {}

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
      children: attendances.filter(
        (a) =>
          [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT].includes(a.status) &&
          a.person.isXicalla,
      ).length,
      total: attendances.length,
    };

    await this.eventRepository.update(eventId, { attendanceSummary: summary });
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
