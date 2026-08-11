import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Event } from '../event/event.entity';
import {
  AssignmentArea,
  AttendanceStatus,
  EventParticipationMeta,
  EventParticipationOverview,
  EventParticipationPerson,
  EventParticipationPersonPosition,
  EventParticipationPlacement,
  EventParticipationSegment,
  FigureZone,
  SegmentConflictKind,
  areaForZone,
  classifyPlacementKind,
} from '@muixer/shared';

/** Attendance statuses that mean "this person is coming / came". */
const CONFIRMED_STATUSES: readonly AttendanceStatus[] = [
  AttendanceStatus.ANIRE,
  AttendanceStatus.ASSISTIT,
];

const NO_TEMPLATE_LABEL = 'Sense plantilla';

interface SegmentRow {
  id: string;
  name: string | null;
  sortOrder: number;
  isVisible: boolean;
  figureNames: (string | null)[];
  figureCount: string;
  snapshottedFigureCount: string;
}

interface MatrixRow {
  personId: string;
  alias: string;
  name: string;
  firstSurname: string;
  shoulderHeight: number | string | null;
  isXicalla: boolean;
  isActive: boolean;
  notes: string | null;
  notesEmoji: string | null;
  attendanceStatus: AttendanceStatus | null;
  assignmentId: string | null;
  segmentId: string | null;
  instanceId: string | null;
  figureLabel: string | null;
  figureTemplateName: string | null;
  nodeId: string | null;
  nodeLabel: string | null;
  zone: FigureZone | null;
  positionType: string | null;
  z: number | string | null;
  renglaPosition: number | string | null;
}

interface PositionRow {
  personId: string;
  id: string;
  name: string;
  slug: string;
  color: string | null;
  positionTypes: string[] | null;
}

/**
 * Builds the person-centric participation overview of an event.
 *
 * Kept apart from `NodeAssignmentService` (which owns assignment *mutation*) and from
 * `AvailablePersonsService` (which owns segment-scoped candidate picking): this is a
 * read-only event-wide aggregate and needs only the event repository plus raw SQL.
 *
 * Cost is a constant 3 queries (2 for an event with no participants), regardless of
 * how many segments, figures or persons the event has.
 */
@Injectable()
export class EventParticipationService {
  constructor(
    @InjectRepository(Event)
    private readonly eventRepository: Repository<Event>,
    private readonly dataSource: DataSource,
  ) {}

  async getEventParticipation(eventId: string): Promise<EventParticipationOverview> {
    const event = await this.eventRepository.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException('Event no trobat.');
    }

    const segments = await this.loadSegments(eventId);
    const segmentIds = segments.map((s) => s.id);

    const matrixRows = await this.loadMatrix(eventId, segmentIds);
    const personIds = [...new Set(matrixRows.map((r) => r.personId))];

    // Skipped entirely when there is nobody to describe — keeps an empty event at 2 queries.
    const positionsByPerson =
      personIds.length > 0 ? await this.loadPositions(personIds) : new Map();

    const persons = this.assemblePersons(matrixRows, positionsByPerson);

    return {
      event: { id: event.id, title: event.title, date: this.toDateString(event.date) },
      segments,
      persons,
      meta: this.buildMeta(persons),
    };
  }

  /** Q1 — the matrix columns, with figure counts and names in a single pass. */
  private async loadSegments(eventId: string): Promise<EventParticipationSegment[]> {
    const rows: SegmentRow[] = await this.dataSource.query(
      `SELECT es.id,
              es.name,
              es."sortOrder",
              es."isVisible",
              COUNT(fi.id)                               AS "figureCount",
              COUNT(fi.id) FILTER (WHERE fi.snapshotted) AS "snapshottedFigureCount",
              COALESCE(
                array_agg(COALESCE(fi.label, tpl.name)) FILTER (WHERE fi.id IS NOT NULL),
                '{}'
              )                                          AS "figureNames"
       FROM event_segments es
       LEFT JOIN figure_instances fi  ON fi."segmentId" = es.id
       LEFT JOIN figure_templates tpl ON tpl.id = fi."figureTemplateId"
       WHERE es."eventId" = $1
       GROUP BY es.id
       ORDER BY es."sortOrder" ASC`,
      [eventId],
    );

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      sortOrder: Number(r.sortOrder),
      figureNames: (r.figureNames ?? []).map((n) => n ?? NO_TEMPLATE_LABEL),
      isVisible: r.isVisible,
      figureCount: parseInt(r.figureCount, 10),
      snapshottedFigureCount: parseInt(r.snapshottedFigureCount, 10),
    }));
  }

  /**
   * Q2 — one row per (person, placement), or a single all-null-placement row for a
   * person who is coming but does nothing.
   *
   * Filters assignments through the denormalized `node_assignments.segmentId` rather
   * than joining `figure_instances`, which saves two joins and hits the
   * `(segmentId, personId)` index directly.
   */
  private async loadMatrix(eventId: string, segmentIds: string[]): Promise<MatrixRow[]> {
    return this.dataSource.query(
      // The `::uuid[]` casts are required, not cosmetic: with an empty segment list
      // Postgres cannot infer the array element type and the query fails.
      // `status::text` avoids depending on the enum type's name, which a past
      // migration already renamed once.
      `WITH participants AS (
         SELECT a."personId" AS id
         FROM attendances a
         WHERE a."eventId" = $1
           AND a.status::text = ANY($3::text[])
         UNION -- UNION, not UNION ALL: a confirmed *and* assigned person must appear once
         SELECT na."personId" AS id
         FROM node_assignments na
         WHERE na."segmentId" = ANY($2::uuid[])
       )
       SELECT p.id                 AS "personId",
              p.alias              AS "alias",
              p.name               AS "name",
              p."firstSurname"     AS "firstSurname",
              p."shoulderHeight"   AS "shoulderHeight",
              p."isXicalla"        AS "isXicalla",
              p."isActive"         AS "isActive",
              p.notes              AS "notes",
              p."notesEmoji"       AS "notesEmoji",
              att.status           AS "attendanceStatus",
              na.id                AS "assignmentId",
              na."segmentId"       AS "segmentId",
              fi.id                AS "instanceId",
              fi.label             AS "figureLabel",
              tpl.name             AS "figureTemplateName",
              inode.id             AS "nodeId",
              inode.label          AS "nodeLabel",
              inode.zone           AS "zone",
              inode."positionType" AS "positionType",
              inode.z              AS "z",
              inode."renglaPosition" AS "renglaPosition"
       FROM persons p
       JOIN participants pt           ON pt.id = p.id
       LEFT JOIN attendances att      ON att."personId" = p.id AND att."eventId" = $1
       LEFT JOIN node_assignments na  ON na."personId" = p.id
                                     AND na."segmentId" = ANY($2::uuid[])
       LEFT JOIN figure_instances fi  ON fi.id    = na."figureInstanceId"
       LEFT JOIN instance_nodes inode ON inode.id = na."instanceNodeId"
       LEFT JOIN figure_templates tpl ON tpl.id   = fi."figureTemplateId"
       ORDER BY p.id, na."segmentId", inode.zone, inode.z, inode.label`,
      [eventId, segmentIds, CONFIRMED_STATUSES as unknown as string[]],
    );
  }

  /**
   * Q3 — tags, fetched separately on purpose: `person_positions` is the one real
   * many-to-many, and joining it into Q2 would multiply every placement row by the
   * person's tag count.
   */
  private async loadPositions(
    personIds: string[],
  ): Promise<Map<string, EventParticipationPersonPosition[]>> {
    const rows: PositionRow[] = await this.dataSource.query(
      `SELECT pp."personsId" AS "personId", t.id, t.name, t.slug, t.color, t."positionTypes"
       FROM person_positions pp
       JOIN positions t ON t.id = pp."positionsId"
       WHERE pp."personsId" = ANY($1::uuid[])
       ORDER BY t.name ASC`,
      [personIds],
    );

    const byPerson = new Map<string, EventParticipationPersonPosition[]>();
    for (const row of rows) {
      const list = byPerson.get(row.personId) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        slug: row.slug,
        color: row.color,
        positionTypes: row.positionTypes ?? [],
      });
      byPerson.set(row.personId, list);
    }
    return byPerson;
  }

  private assemblePersons(
    rows: MatrixRow[],
    positionsByPerson: Map<string, EventParticipationPersonPosition[]>,
  ): EventParticipationPerson[] {
    const byId = new Map<string, EventParticipationPerson>();

    for (const row of rows) {
      let person = byId.get(row.personId);
      if (!person) {
        person = {
          id: row.personId,
          alias: row.alias,
          name: row.name,
          firstSurname: row.firstSurname,
          shoulderHeight: row.shoulderHeight === null ? null : Number(row.shoulderHeight),
          isXicalla: row.isXicalla,
          isActive: row.isActive,
          notes: row.notes,
          notesEmoji: row.notesEmoji,
          // No attendance row means the person is here only because they hold a
          // placement: assigned without ever being asked.
          attendanceStatus: row.attendanceStatus ?? AttendanceStatus.PENDENT,
          positions: positionsByPerson.get(row.personId) ?? [],
          placements: {},
          assignedSegmentCount: 0,
          placementCount: 0,
          troncPlacementCount: 0,
          conflictSegmentIds: [],
        };
        byId.set(row.personId, person);
      }

      if (row.assignmentId === null || row.segmentId === null) continue;

      // Push, never assign: a person may hold several placements in one segment.
      const bucket = person.placements[row.segmentId] ?? [];
      bucket.push(this.toPlacement(row));
      person.placements[row.segmentId] = bucket;
    }

    for (const person of byId.values()) {
      const segmentIds = Object.keys(person.placements);
      person.assignedSegmentCount = segmentIds.length;
      person.placementCount = segmentIds.reduce(
        (total, id) => total + person.placements[id].length,
        0,
      );
      // BASE→TRONC (D10): tronc load counts every TRONC/BASE placement, event-wide.
      person.troncPlacementCount = segmentIds.reduce(
        (total, id) =>
          total + person.placements[id].filter((p) => p.area === AssignmentArea.TRONC).length,
        0,
      );
      // A conflict is >1 placement in the SAME segment. Placements spread across
      // different segments are legal and must not be reported.
      person.conflictSegmentIds = segmentIds.filter((id) => person.placements[id].length > 1);
    }

    return [...byId.values()];
  }

  private toPlacement(row: MatrixRow): EventParticipationPlacement {
    return {
      assignmentId: row.assignmentId as string,
      instanceId: row.instanceId as string,
      figureName: row.figureLabel ?? row.figureTemplateName ?? NO_TEMPLATE_LABEL,
      nodeId: row.nodeId as string,
      nodeLabel: row.nodeLabel ?? '',
      zone: row.zone as FigureZone,
      // DECORATION is the only zone that maps to null, and decoration nodes are never
      // assignable — so a placement always has a real area. Cast mirrors the canonical
      // engine (`classifySegmentConflicts`) so both stay consistent.
      area: areaForZone(row.zone as FigureZone) as AssignmentArea,
      positionType: row.positionType ?? null,
      z: Number(row.z ?? 0),
      renglaPosition:
        row.renglaPosition === null || row.renglaPosition === undefined
          ? null
          : Number(row.renglaPosition),
    };
  }

  /**
   * `Event.date` is declared as `Date` but maps a `date` column, which the driver
   * hands back as a `'YYYY-MM-DD'` string. Handles both so the contract can honestly
   * promise a string.
   */
  private toDateString(date: Date | string): string {
    return typeof date === 'string' ? date : date.toISOString().slice(0, 10);
  }

  private buildMeta(persons: EventParticipationPerson[]): EventParticipationMeta {
    const conflictsByKind: Record<SegmentConflictKind, number> = {
      [SegmentConflictKind.TRONC_TRONC]: 0,
      [SegmentConflictKind.TRONC_PINYA]: 0,
      [SegmentConflictKind.PINYA_PINYA]: 0,
    };
    // Classify every (person, segment) conflict through the shared rule so the kind
    // can never diverge from the canonical `getSegmentConflicts` (D13).
    for (const person of persons) {
      for (const segmentId of person.conflictSegmentIds) {
        const kind = classifyPlacementKind(person.placements[segmentId].map((p) => p.area));
        conflictsByKind[kind] += 1;
      }
    }

    return {
      distinctPersons: persons.length,
      personsWithPlacement: persons.filter((p) => p.placementCount > 0).length,
      totalPlacements: persons.reduce((total, p) => total + p.placementCount, 0),
      conflictedPersons: persons.filter((p) => p.conflictSegmentIds.length > 0).length,
      conflictsByKind,
      troncPlacements: persons.reduce((total, p) => total + p.troncPlacementCount, 0),
    };
  }
}
