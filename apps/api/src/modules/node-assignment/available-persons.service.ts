import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { NodeAssignment } from './entities/node-assignment.entity';
import { AttendanceStatus, EventType } from '@muixer/shared';

export interface AvailablePersonDto {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  attendanceStatus: AttendanceStatus;
  nextPerformanceStatus: AttendanceStatus | null;
  assignedInSegment: boolean;
}

export interface AvailablePersonsQuery {
  search?: string;
  height?: number;
  isXicalla?: boolean;
  excludeAssigned?: boolean;
}

@Injectable()
export class AvailablePersonsService {
  constructor(
    @InjectRepository(Person)
    private readonly personRepository: Repository<Person>,
    @InjectRepository(Attendance)
    private readonly attendanceRepository: Repository<Attendance>,
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    @InjectRepository(EventSegment)
    private readonly eventSegmentRepository: Repository<EventSegment>,
    @InjectRepository(NodeAssignment)
    private readonly assignmentRepository: Repository<NodeAssignment>,
  ) {}

  async getAvailablePersons(
    eventId: string,
    segmentId: string,
    query: AvailablePersonsQuery = {},
  ): Promise<AvailablePersonDto[]> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event with ID ${eventId} not found`);
    }

    const segment = await this.eventSegmentRepository.findOne({
      where: { id: segmentId, event: { id: eventId } },
    });
    if (!segment) {
      throw new NotFoundException(
        `Segment with ID ${segmentId} not found or does not belong to event ${eventId}`,
      );
    }

    const { search, height, isXicalla, excludeAssigned = true } = query;

    // Build base person query
    const qb = this.personRepository
      .createQueryBuilder('person')
      .where('person.isActive = true');

    if (search) {
      qb.andWhere(
        '(person.alias ILIKE :search OR person.name ILIKE :search OR person.firstSurname ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (typeof isXicalla === 'boolean') {
      qb.andWhere('person.isXicalla = :isXicalla', { isXicalla });
    }

    if (excludeAssigned) {
      qb.andWhere(
        `NOT EXISTS (
          SELECT 1 FROM node_assignments na
          INNER JOIN figure_instances fi ON fi.id = na."figureInstanceId"
          WHERE fi."segmentId" = :segmentId
            AND na."personId" = person.id
        )`,
        { segmentId },
      );
    }

    if (height !== undefined) {
      qb.orderBy(`ABS(COALESCE(person.shoulderHeight, 0) - :height)`, 'ASC');
      qb.setParameter('height', height);
    } else {
      qb.orderBy('person.alias', 'ASC');
    }

    const persons = await qb.getMany();

    // Fetch current event attendances for the returned persons in one query
    const personIds = persons.map((p) => p.id);
    const currentAttendanceMap = new Map<string, AttendanceStatus>();
    if (personIds.length > 0) {
      const currentAttendances = await this.attendanceRepository.find({
        where: { event: { id: eventId }, person: { id: In(personIds) } },
        relations: ['person'],
      });
      currentAttendances.forEach((a) => {
        currentAttendanceMap.set(a.person.id, a.status);
      });
    }

    // Get assigned person IDs in this segment (for `assignedInSegment` flag)
    const assignedInSegment = new Set<string>();
    if (!excludeAssigned) {
      const assigned = await this.assignmentRepository
        .createQueryBuilder('a')
        .innerJoin('a.figureInstance', 'fi')
        .where('fi.segmentId = :segmentId', { segmentId })
        .select('a.personId')
        .getMany();
      assigned.forEach((a) => assignedInSegment.add((a as any).personId));
    }

    // Get next performance event for next-performance status
    const nextPerformance = event.eventType === EventType.ASSAIG
      ? await this.getNextPerformance(eventId)
      : null;

    // Get next performance attendances if applicable
    const nextAttendanceMap = new Map<string, AttendanceStatus>();
    if (nextPerformance) {
      const nextAttendances = await this.attendanceRepository.find({
        where: { event: { id: nextPerformance.id } },
        relations: ['person'],
      });
      nextAttendances.forEach((a) => {
        nextAttendanceMap.set(a.person.id, a.status);
      });
    }

    return persons.map((person) => {
      const attendanceStatus: AttendanceStatus =
        currentAttendanceMap.get(person.id) ?? AttendanceStatus.PENDENT;
      const nextPerformanceStatus = nextPerformance
        ? (nextAttendanceMap.get(person.id) ?? null)
        : null;

      return {
        id: person.id,
        alias: person.alias,
        name: person.name,
        firstSurname: person.firstSurname,
        shoulderHeight: person.shoulderHeight,
        isXicalla: person.isXicalla,
        attendanceStatus,
        nextPerformanceStatus,
        assignedInSegment: excludeAssigned ? false : assignedInSegment.has(person.id),
      };
    });
  }

  async getNextPerformance(eventId: string): Promise<Event | null> {
    const currentEvent = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!currentEvent) {
      return null;
    }

    const nextEvent = await this.eventRepository.findOne({
      where: {
        eventType: EventType.ACTUACIO,
        date: MoreThan(currentEvent.date),
      },
      order: { date: 'ASC' },
    });

    return nextEvent ?? null;
  }
}
