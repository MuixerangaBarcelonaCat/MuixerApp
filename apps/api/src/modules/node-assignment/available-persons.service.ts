import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, In } from 'typeorm';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { NodeAssignment } from './entities/node-assignment.entity';
import {
  AttendanceStatus,
  EventType,
  FigureZone,
  AssignmentArea,
  areaForZone,
  ConflictPlacement,
} from '@muixer/shared';

interface AvailablePersonPositionDto {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  positionTypes: string[];
}

export interface AvailablePersonDto {
  id: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | null;
  isXicalla: boolean;
  notes: string | null;
  notesEmoji: string | null;
  attendanceStatus: AttendanceStatus;
  nextPerformanceStatus: AttendanceStatus | null;
  assignedPlacements: ConflictPlacement[];
  assignedInTronc: boolean;
  assignedInPinya: boolean;
  conflictInSegment: boolean;
  positions: AvailablePersonPositionDto[];
}

export interface AvailablePersonsQuery {
  search?: string;
  height?: number;
  isXicalla?: boolean;
  excludeAssigned?: boolean;
  positionId?: string;
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

    const { search, height, positionId, isXicalla: isXicallaBool } = query;
    const excludeAssignedBool = query.excludeAssigned ?? true;

    // Build base person query
    const qb = this.personRepository
      .createQueryBuilder('person')
      .leftJoinAndSelect('person.positions', 'positions')
      .where('person.isActive = true');

    if (search) {
      qb.andWhere(
        `(
          unaccent(lower(person.alias)) LIKE unaccent(lower(:searchPattern))
          OR unaccent(lower(person.name)) LIKE unaccent(lower(:searchPattern))
          OR GREATEST(
            word_similarity(unaccent(lower(:rawSearch)), unaccent(lower(person.alias))),
            word_similarity(unaccent(lower(:rawSearch)), unaccent(lower(person.name)))
          ) > 0.2
        )`,
        { searchPattern: `%${search}%`, rawSearch: search },
      );
    }

    if (isXicallaBool !== undefined) {
      qb.andWhere('person.isXicalla = :isXicalla', { isXicalla: isXicallaBool });
    }

    if (positionId) {
      qb.andWhere((qbSub) => {
        const subQuery = qbSub
          .subQuery()
          .select('sub_person.id')
          .from(Person, 'sub_person')
          .innerJoin('sub_person.positions', 'sub_position')
          .where('sub_position.id = :positionId')
          .getQuery();
        return 'person.id IN ' + subQuery;
      });
      qb.setParameter('positionId', positionId);
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

    if (search) {
      qb.orderBy(
        `GREATEST(
          word_similarity(unaccent(lower(:rawSearch)), unaccent(lower(person.alias))),
          word_similarity(unaccent(lower(:rawSearch)), unaccent(lower(person.name)))
        )`,
        'DESC',
      );
      if (height !== undefined) {
        qb.addOrderBy(
          `CASE WHEN person.shoulderHeight IS NULL OR person.shoulderHeight = 0 THEN 1 ELSE 0 END`,
          'ASC',
        );
        qb.addOrderBy(`ABS(COALESCE(person.shoulderHeight, 0) - :height)`, 'ASC');
        qb.setParameter('height', height);
      } else {
        qb.addOrderBy('person.alias', 'ASC');
      }
    } else if (height !== undefined) {
      qb.orderBy(
        `CASE WHEN person.shoulderHeight IS NULL OR person.shoulderHeight = 0 THEN 1 ELSE 0 END`,
        'ASC',
      );
      qb.addOrderBy(`ABS(COALESCE(person.shoulderHeight, 0) - :height)`, 'ASC');
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

    // Get assigned person details in this segment (for `assignedPlacements`/`assignedInTronc`/
    // `assignedInPinya`). Accumulate ALL placements per person rather than `.set()` in a loop,
    // which kept an arbitrary (last) row (§2).
    const assignedDetails = new Map<string, ConflictPlacement[]>();
    if (!excludeAssignedBool) {
      const segmentAssignments = await this.assignmentRepository.find({
        where: { figureInstance: { segment: { id: segmentId } } },
        relations: ['figureInstance', 'figureInstance.figureTemplate', 'instanceNode', 'person'],
      });
      segmentAssignments.forEach((assignment) => {
        const zone = assignment.instanceNode?.zone as FigureZone;
        const placement: ConflictPlacement = {
          assignmentId: assignment.id,
          figureInstanceId: assignment.figureInstance.id,
          figureName: assignment.figureInstance.figureTemplate?.name ?? 'Sense plantilla',
          nodeId: assignment.instanceNode?.id ?? '',
          nodeLabel: assignment.instanceNode?.label ?? '',
          zone,
          area: areaForZone(zone) as AssignmentArea,
          z: assignment.instanceNode?.z ?? null,
          renglaPosition: assignment.instanceNode?.renglaPosition ?? null,
          cordon: assignment.instanceNode?.renglaPosition ?? null,
        };
        const existing = assignedDetails.get(assignment.person.id);
        if (existing) existing.push(placement);
        else assignedDetails.set(assignment.person.id, [placement]);
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
      const placements = assignedDetails.get(person.id) ?? [];

      return {
        id: person.id,
        alias: person.alias,
        name: person.name,
        firstSurname: person.firstSurname,
        shoulderHeight: person.shoulderHeight,
        isXicalla: person.isXicalla,
        notes: person.notes,
        notesEmoji: person.notesEmoji,
        attendanceStatus,
        nextPerformanceStatus,
        assignedPlacements: placements,
        assignedInTronc: placements.some((p) => p.area === AssignmentArea.TRONC),
        assignedInPinya: placements.some((p) => p.area === AssignmentArea.PINYA),
        conflictInSegment: false,
        positions: (person.positions ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          color: p.color,
          positionTypes: p.positionTypes ?? [],
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
