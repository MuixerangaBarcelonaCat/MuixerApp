import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { AttendanceStatus, AvailablePerson, AvailablePersonPosition, EventType } from '@muixer/shared';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { NodeAssignment } from './entities/node-assignment.entity';

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
  ): Promise<AvailablePerson[]> {
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

    const { search, height } = query;

    // HTTP query params arrive as strings — coerce booleans explicitly
    const raw = query as unknown as Record<string, string | boolean | undefined>;
    const coerceBool = (v: string | boolean | undefined, def: boolean): boolean => {
      if (v === undefined) return def;
      if (typeof v === 'boolean') return v;
      return v === 'true';
    };
    const isXicallaBool: boolean | undefined =
      raw['isXicalla'] === undefined ? undefined : coerceBool(raw['isXicalla'], false);
    const excludeAssignedBool = coerceBool(raw['excludeAssigned'], true);

    // Build base person query
    const qb = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'positions')
      .where('person.isActive = true');

    if (search) {
      qb.andWhere(
        '(person.alias ILIKE :search OR person.name ILIKE :search OR person.firstSurname ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    if (isXicallaBool !== undefined) {
      qb.andWhere('person.isXicalla = :isXicalla', { isXicalla: isXicallaBool });
    }

    if (excludeAssignedBool) {
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

    // Get assigned person details in this segment (for `assignedInSegment` flag + location)
    const assignedDetails = new Map<string, { instanceId: string; nodeLabel: string }>();
    if (!excludeAssignedBool) {
      const segmentAssignments = await this.assignmentRepository.find({
        where: { figureInstance: { segment: { id: segmentId } } },
        relations: ['figureInstance', 'instanceNode', 'person'],
      });
      segmentAssignments.forEach((assignment) => {
        assignedDetails.set(assignment.person.id, {
          instanceId: assignment.figureInstance.id,
          nodeLabel: assignment.instanceNode?.label ?? '',
        });
      });
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
      const detail = assignedDetails.get(person.id);

      return {
        id: person.id,
        alias: person.alias,
        name: person.name,
        firstSurname: person.firstSurname,
        shoulderHeight: person.shoulderHeight,
        isXicalla: person.isXicalla,
        attendanceStatus,
        nextPerformanceStatus,
        assignedInSegment: !excludeAssignedBool && assignedDetails.has(person.id),
        assignedInstanceId: detail?.instanceId,
        assignedNodeLabel: detail?.nodeLabel,
        positions: (person.positions ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
        })),
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
