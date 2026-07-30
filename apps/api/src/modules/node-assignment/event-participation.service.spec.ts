import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventParticipationService } from './event-participation.service';
import { Event } from '../event/event.entity';
import { AttendanceStatus, EventType, FigureZone } from '@muixer/shared';

const EVENT_ID = 'event-uuid-1';
const SEG_A = 'segment-uuid-a';
const SEG_B = 'segment-uuid-b';
const PERSON_1 = 'person-uuid-1';
const PERSON_2 = 'person-uuid-2';

const makeEvent = (overrides: Partial<Event> = {}): Event =>
  ({
    id: EVENT_ID,
    eventType: EventType.ASSAIG,
    title: 'Assaig Diumenge',
    date: '2026-05-01',
    ...overrides,
  }) as unknown as Event;

const makeSegmentRow = (id: string, overrides: Record<string, unknown> = {}) => ({
  id,
  name: `Segment ${id}`,
  sortOrder: 0,
  isVisible: true,
  figureNames: ['4d7'],
  figureCount: '1',
  snapshottedFigureCount: '1',
  ...overrides,
});

/** One raw row of Q2. Pass `segmentId: null` for a person with nothing to do. */
const makeMatrixRow = (
  personId: string,
  segmentId: string | null,
  overrides: Record<string, unknown> = {},
) => ({
  personId,
  alias: 'PERSIANA',
  name: 'Joana',
  firstSurname: 'Vila',
  shoulderHeight: 140,
  isXicalla: false,
  isActive: true,
  notes: null,
  notesEmoji: null,
  attendanceStatus: AttendanceStatus.ANIRE,
  assignmentId: segmentId ? `assignment-${personId}-${segmentId}` : null,
  segmentId,
  instanceId: segmentId ? 'instance-1' : null,
  figureLabel: null,
  figureTemplateName: segmentId ? '4d7' : null,
  nodeId: segmentId ? 'node-1' : null,
  nodeLabel: segmentId ? 'Mans' : null,
  zone: segmentId ? FigureZone.PINYA : null,
  positionType: null,
  z: segmentId ? 0 : null,
  renglaPosition: segmentId ? 2 : null,
  ...overrides,
});

describe('EventParticipationService', () => {
  let service: EventParticipationService;
  let query: jest.Mock;
  let findOne: jest.Mock;

  /** Primes `dataSource.query` in call order: segments → matrix → positions. */
  const primeQueries = (
    segmentRows: unknown[],
    matrixRows: unknown[],
    positionRows: unknown[] = [],
  ) => {
    query
      .mockResolvedValueOnce(segmentRows)
      .mockResolvedValueOnce(matrixRows)
      .mockResolvedValueOnce(positionRows);
  };

  beforeEach(async () => {
    query = jest.fn();
    findOne = jest.fn().mockResolvedValue(makeEvent());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventParticipationService,
        { provide: getRepositoryToken(Event), useValue: { findOne } },
        { provide: DataSource, useValue: { query } },
      ],
    }).compile();

    service = module.get(EventParticipationService);
  });

  describe('event lookup', () => {
    it('throws 404 and runs no query when the event does not exist', async () => {
      findOne.mockResolvedValue(null);

      await expect(service.getEventParticipation(EVENT_ID)).rejects.toThrow(NotFoundException);
      expect(query).not.toHaveBeenCalled();
    });

    it('returns the event identity with the date as a string', async () => {
      primeQueries([], []);

      const result = await service.getEventParticipation(EVENT_ID);

      expect(result.event).toEqual({ id: EVENT_ID, title: 'Assaig Diumenge', date: '2026-05-01' });
    });

    it('formats a Date instance into YYYY-MM-DD', async () => {
      findOne.mockResolvedValue(makeEvent({ date: new Date('2026-05-01T00:00:00Z') } as never));
      primeQueries([], []);

      const result = await service.getEventParticipation(EVENT_ID);

      expect(result.event.date).toBe('2026-05-01');
    });
  });

  describe('segments (columns)', () => {
    it('coerces counts to numbers and defaults missing template names', async () => {
      primeQueries(
        [
          makeSegmentRow(SEG_A, {
            figureCount: '3',
            snapshottedFigureCount: '2',
            figureNames: ['4d7', null],
            sortOrder: '1',
          }),
        ],
        [],
      );

      const { segments } = await service.getEventParticipation(EVENT_ID);

      expect(segments[0].figureCount).toBe(3);
      expect(segments[0].snapshottedFigureCount).toBe(2);
      expect(segments[0].sortOrder).toBe(1);
      expect(segments[0].figureNames).toEqual(['4d7', 'Sense plantilla']);
    });

    it('returns an empty column set for an event with no segments', async () => {
      primeQueries([], [makeMatrixRow(PERSON_1, null)]);

      const { segments, persons } = await service.getEventParticipation(EVENT_ID);

      expect(segments).toEqual([]);
      expect(persons[0].placements).toEqual({});
    });
  });

  describe('population', () => {
    it('keeps a confirmed person who has nothing to do', async () => {
      primeQueries([makeSegmentRow(SEG_A)], [makeMatrixRow(PERSON_1, null)]);

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons).toHaveLength(1);
      expect(persons[0].assignedSegmentCount).toBe(0);
      expect(persons[0].placementCount).toBe(0);
      expect(persons[0].attendanceStatus).toBe(AttendanceStatus.ANIRE);
    });

    it('keeps an assigned person who declined, without altering their status', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A, { attendanceStatus: AttendanceStatus.NO_VAIG })],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].attendanceStatus).toBe(AttendanceStatus.NO_VAIG);
      expect(persons[0].placementCount).toBe(1);
    });

    it('treats a missing attendance row as PENDENT', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A, { attendanceStatus: null })],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].attendanceStatus).toBe(AttendanceStatus.PENDENT);
    });

    it('keeps a soft-deleted person, flagged, so an occupied node never looks free', async () => {
      primeQueries([makeSegmentRow(SEG_A)], [makeMatrixRow(PERSON_1, SEG_A, { isActive: false })]);

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].isActive).toBe(false);
      expect(persons[0].placementCount).toBe(1);
    });

    it('returns nobody and skips the tag query for an event with no participants', async () => {
      query.mockResolvedValueOnce([makeSegmentRow(SEG_A)]).mockResolvedValueOnce([]);

      const { persons, meta } = await service.getEventParticipation(EVENT_ID);

      expect(persons).toEqual([]);
      expect(meta).toEqual({
        distinctPersons: 0,
        personsWithPlacement: 0,
        totalPlacements: 0,
        conflictedPersons: 0,
      });
      // Segments + matrix only: the tag query must not run.
      expect(query).toHaveBeenCalledTimes(2);
    });
  });

  describe('placements', () => {
    it('groups a person across segments into one row keyed by segment', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)],
        [makeMatrixRow(PERSON_1, SEG_A), makeMatrixRow(PERSON_1, SEG_B)],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons).toHaveLength(1);
      expect(Object.keys(persons[0].placements).sort()).toEqual([SEG_A, SEG_B].sort());
      expect(persons[0].assignedSegmentCount).toBe(2);
      expect(persons[0].placementCount).toBe(2);
    });

    it('resolves the figure name as label → template name → fallback', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [
          makeMatrixRow(PERSON_1, SEG_A, { figureLabel: '3d7 de la plaça', figureTemplateName: '3d7' }),
          makeMatrixRow(PERSON_2, SEG_A, { figureLabel: null, figureTemplateName: '3d7' }),
        ],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].placements[SEG_A][0].figureName).toBe('3d7 de la plaça');
      expect(persons[1].placements[SEG_A][0].figureName).toBe('3d7');
    });

    it('falls back to "Sense plantilla" when neither label nor template exists', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A, { figureLabel: null, figureTemplateName: null })],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].placements[SEG_A][0].figureName).toBe('Sense plantilla');
    });

    it('coerces raw numeric strings and preserves a null cordon', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A, { z: '3', renglaPosition: '2', shoulderHeight: '140' })],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);
      const placement = persons[0].placements[SEG_A][0];

      expect(placement.z).toBe(3);
      expect(placement.renglaPosition).toBe(2);
      expect(persons[0].shoulderHeight).toBe(140);
    });

    it('keeps a null cordon null instead of coercing it to 0', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A, { renglaPosition: null })],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].placements[SEG_A][0].renglaPosition).toBeNull();
    });
  });

  describe('conflicts (>1 placement in the same segment)', () => {
    /**
     * Unreachable through the API today — the `(segmentId, personId)` unique constraint
     * blocks it — but legal once the segments-flexibility change drops that constraint.
     * This is the guard that stops anyone collapsing the mapper back to a single value
     * per cell, which would silently discard placements.
     */
    it('keeps every placement when a person appears twice in the same segment', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [
          makeMatrixRow(PERSON_1, SEG_A, {
            assignmentId: 'assignment-1',
            nodeId: 'node-1',
            nodeLabel: 'Mans',
          }),
          makeMatrixRow(PERSON_1, SEG_A, {
            assignmentId: 'assignment-2',
            nodeId: 'node-2',
            nodeLabel: 'Vent',
          }),
        ],
      );

      const { persons, meta } = await service.getEventParticipation(EVENT_ID);

      expect(persons).toHaveLength(1);
      expect(persons[0].placements[SEG_A]).toHaveLength(2);
      expect(persons[0].placements[SEG_A].map((p) => p.nodeLabel)).toEqual(['Mans', 'Vent']);
      expect(persons[0].assignedSegmentCount).toBe(1);
      expect(persons[0].placementCount).toBe(2);
      expect(persons[0].conflictSegmentIds).toEqual([SEG_A]);
      expect(meta.conflictedPersons).toBe(1);
    });

    it('does NOT report a conflict for placements in different segments', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)],
        [makeMatrixRow(PERSON_1, SEG_A), makeMatrixRow(PERSON_1, SEG_B)],
      );

      const { persons, meta } = await service.getEventParticipation(EVENT_ID);

      // Being in two different segments is legal: the person is in two places at
      // different times, not at once.
      expect(persons[0].conflictSegmentIds).toEqual([]);
      expect(meta.conflictedPersons).toBe(0);
    });

    it('reports only the segment that is actually duplicated', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)],
        [
          makeMatrixRow(PERSON_1, SEG_A, { assignmentId: 'a-1', nodeId: 'n-1' }),
          makeMatrixRow(PERSON_1, SEG_A, { assignmentId: 'a-2', nodeId: 'n-2' }),
          makeMatrixRow(PERSON_1, SEG_B, { assignmentId: 'a-3', nodeId: 'n-3' }),
        ],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].conflictSegmentIds).toEqual([SEG_A]);
      expect(persons[0].placementCount).toBe(3);
      expect(persons[0].assignedSegmentCount).toBe(2);
    });
  });

  describe('tags', () => {
    it('does not duplicate tags when the person holds several placements', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)],
        [makeMatrixRow(PERSON_1, SEG_A), makeMatrixRow(PERSON_1, SEG_B)],
        [
          { personId: PERSON_1, id: 'tag-1', name: 'Baix', slug: 'baix', color: '#111', positionTypes: [] },
          { personId: PERSON_1, id: 'tag-2', name: 'Crossa', slug: 'crossa', color: '#222', positionTypes: null },
        ],
      );

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].positions).toHaveLength(2);
      expect(persons[0].positions.map((p) => p.name)).toEqual(['Baix', 'Crossa']);
      expect(persons[0].positions[1].positionTypes).toEqual([]);
    });

    it('gives a person with no tags an empty array', async () => {
      primeQueries([makeSegmentRow(SEG_A)], [makeMatrixRow(PERSON_1, SEG_A)], []);

      const { persons } = await service.getEventParticipation(EVENT_ID);

      expect(persons[0].positions).toEqual([]);
    });
  });

  describe('meta', () => {
    it('counts distinct persons, those with placements, and total placements', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)],
        [
          makeMatrixRow(PERSON_1, SEG_A),
          makeMatrixRow(PERSON_1, SEG_B),
          makeMatrixRow(PERSON_2, null),
        ],
      );

      const { meta } = await service.getEventParticipation(EVENT_ID);

      expect(meta).toEqual({
        distinctPersons: 2,
        personsWithPlacement: 1,
        totalPlacements: 2,
        conflictedPersons: 0,
      });
    });
  });

  describe('query parameters', () => {
    it('scopes assignments to the event segments and filters by confirmed statuses', async () => {
      primeQueries([makeSegmentRow(SEG_A), makeSegmentRow(SEG_B)], [makeMatrixRow(PERSON_1, SEG_A)]);

      await service.getEventParticipation(EVENT_ID);

      const [, params] = query.mock.calls[1];
      expect(params[0]).toBe(EVENT_ID);
      expect(params[1]).toEqual([SEG_A, SEG_B]);
      expect(params[2]).toEqual([AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT]);
    });

    it('passes an empty segment array when the event has none', async () => {
      primeQueries([], []);

      await service.getEventParticipation(EVENT_ID);

      expect(query.mock.calls[1][1][1]).toEqual([]);
    });

    it('asks for tags of the distinct persons only', async () => {
      primeQueries(
        [makeSegmentRow(SEG_A)],
        [makeMatrixRow(PERSON_1, SEG_A), makeMatrixRow(PERSON_1, SEG_A, { assignmentId: 'a-2', nodeId: 'n-2' }), makeMatrixRow(PERSON_2, null)],
        [],
      );

      await service.getEventParticipation(EVENT_ID);

      expect(query.mock.calls[2][1][0]).toEqual([PERSON_1, PERSON_2]);
    });
  });
});
