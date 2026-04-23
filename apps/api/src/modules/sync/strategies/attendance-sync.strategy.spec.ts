import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttendanceSyncStrategy } from './attendance-sync.strategy';
import { LegacyApiClient } from '../legacy-api.client';
import { Attendance } from '../../event/attendance.entity';
import { Event } from '../../event/event.entity';
import { Person } from '../../person/person.entity';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { SyncEvent } from '../interfaces/sync-event.interface';
import { XlsxAttendanceRow } from '../interfaces/legacy-event.interface';

const mockUpdateQueryBuilder = {
  update: jest.fn().mockReturnThis(),
  set: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  execute: jest.fn().mockResolvedValue(undefined),
};

describe('AttendanceSyncStrategy', () => {
  let strategy: AttendanceSyncStrategy;
  let legacyApiClient: jest.Mocked<Pick<LegacyApiClient, 'getAssistenciesXlsx'>>;
  let attendanceRepository: {
    find: jest.Mock;
    upsert: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let eventRepository: { update: jest.Mock };
  let personRepository: { find: jest.Mock };

  const makePerson = (legacyId: string, overrides: Partial<Person> = {}): Person =>
    ({ id: `person-${legacyId}`, legacyId, isXicalla: false, ...overrides } as unknown as Person);

  const makeEvent = (overrides: Partial<Event> = {}): Event =>
    ({
      id: 'event-uuid',
      legacyId: '42',
      title: 'ASSAIG GENERAL',
      eventType: EventType.ASSAIG,
      date: new Date('2020-01-15'),
      startTime: '18:45',
      ...overrides,
    } as unknown as Event);

  const makeRow = (overrides: Partial<XlsxAttendanceRow> = {}): XlsxAttendanceRow => ({
    legacyPersonId: '100',
    personLabel: 'Doe, John / Johny',
    notes: null,
    estat: 'Vinc',
    instant: '15/01/2020 20:00:00',
    ...overrides,
  });

  beforeEach(async () => {
    attendanceRepository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => mockUpdateQueryBuilder),
    };
    eventRepository = { update: jest.fn().mockResolvedValue(undefined) };
    personRepository = { find: jest.fn().mockResolvedValue([]) };

    legacyApiClient = {
      getAssistenciesXlsx: jest.fn(),
    } as unknown as jest.Mocked<Pick<LegacyApiClient, 'getAssistenciesXlsx'>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceSyncStrategy,
        { provide: LegacyApiClient, useValue: legacyApiClient },
        { provide: getRepositoryToken(Attendance), useValue: attendanceRepository },
        { provide: getRepositoryToken(Event), useValue: eventRepository },
        { provide: getRepositoryToken(Person), useValue: personRepository },
      ],
    }).compile();

    strategy = module.get<AttendanceSyncStrategy>(AttendanceSyncStrategy);
  });

  // ─── mapAttendanceStatus ────────────────────────────────────────────────────

  describe('mapAttendanceStatus', () => {
    describe('past ASSAIG', () => {
      it.each([
        ['Vinc', AttendanceStatus.ASSISTIT],
        ['Potser', AttendanceStatus.NO_PRESENTAT],
        ['No vinc', AttendanceStatus.NO_VAIG],
        [null, AttendanceStatus.PENDENT],
      ])('estat=%s → %s', (estat, expected) => {
        expect(strategy.mapAttendanceStatus(estat as XlsxAttendanceRow['estat'], EventType.ASSAIG, true)).toBe(expected);
      });
    });

    describe('future ASSAIG', () => {
      it.each([
        ['Vinc', AttendanceStatus.ANIRE],
        ['Potser', AttendanceStatus.ANIRE],
        ['No vinc', AttendanceStatus.NO_VAIG],
        [null, AttendanceStatus.PENDENT],
      ])('estat=%s → %s', (estat, expected) => {
        expect(strategy.mapAttendanceStatus(estat as XlsxAttendanceRow['estat'], EventType.ASSAIG, false)).toBe(expected);
      });
    });

    describe('past ACTUACIO', () => {
      it.each([
        ['Vinc', AttendanceStatus.ASSISTIT],
        ['No vinc', AttendanceStatus.NO_VAIG],
        ['Potser', AttendanceStatus.NO_PRESENTAT],
        [null, AttendanceStatus.PENDENT],
      ])('estat=%s → %s', (estat, expected) => {
        expect(strategy.mapAttendanceStatus(estat as XlsxAttendanceRow['estat'], EventType.ACTUACIO, true)).toBe(expected);
      });
    });

    describe('future ACTUACIO', () => {
      it.each([
        ['Vinc', AttendanceStatus.ANIRE],
        ['Potser', AttendanceStatus.ANIRE],
        ['No vinc', AttendanceStatus.NO_VAIG],
        [null, AttendanceStatus.PENDENT],
      ])('estat=%s → %s', (estat, expected) => {
        expect(strategy.mapAttendanceStatus(estat as XlsxAttendanceRow['estat'], EventType.ACTUACIO, false)).toBe(expected);
      });
    });
  });

  // ─── computeIsLateCancel ────────────────────────────────────────────────────

  describe('computeIsLateCancel', () => {
    const eventStartMs = new Date('2026-04-15T18:45:00').getTime();

    it('returns true when respondedAt is within 6h window', () => {
      const respondedAt = new Date('2026-04-15T14:00:00'); // 4h45m before
      expect(strategy.computeIsLateCancel(respondedAt, eventStartMs)).toBe(true);
    });

    it('returns true exactly at 6h boundary', () => {
      const respondedAt = new Date('2026-04-15T12:45:00'); // exactly 6h before
      expect(strategy.computeIsLateCancel(respondedAt, eventStartMs)).toBe(true);
    });

    it('returns false when respondedAt is outside the 6h window', () => {
      const respondedAt = new Date('2026-04-15T10:00:00'); // 8h45m before
      expect(strategy.computeIsLateCancel(respondedAt, eventStartMs)).toBe(false);
    });

    it('returns false when respondedAt is after event start', () => {
      const respondedAt = new Date('2026-04-15T19:00:00');
      expect(strategy.computeIsLateCancel(respondedAt, eventStartMs)).toBe(false);
    });

    it('returns false when respondedAt is null', () => {
      expect(strategy.computeIsLateCancel(null, eventStartMs)).toBe(false);
    });

    it('returns false when eventStartMs is null', () => {
      const respondedAt = new Date('2026-04-15T15:00:00');
      expect(strategy.computeIsLateCancel(respondedAt, null)).toBe(false);
    });
  });

  // ─── parseTimestamp ─────────────────────────────────────────────────────────

  describe('parseTimestamp', () => {
    it('parses DD/MM/YYYY HH:MM:SS', () => {
      const result = strategy.parseTimestamp('05/03/2026 12:59:18');
      expect(result).toBeInstanceOf(Date);
      if (!result) throw new Error('Expected a Date');
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(2); // March = 2 (0-indexed)
      expect(result.getDate()).toBe(5);
      expect(result.getHours()).toBe(12);
    });

    it('returns null for null input', () => {
      expect(strategy.parseTimestamp(null)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(strategy.parseTimestamp('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(strategy.parseTimestamp('not-a-date')).toBeNull();
    });
  });

  // ─── syncAll integration ─────────────────────────────────────────────────────

  describe('syncAll', () => {
    it('upserts attendance matched by legacyPersonId and maps past Vinc → ASSISTIT', async () => {
      const person = makePerson('100');
      const event = makeEvent(); // past event (2020)
      personRepository.find.mockResolvedValue([person]);
      (legacyApiClient.getAssistenciesXlsx as jest.Mock).mockResolvedValue([
        makeRow({ legacyPersonId: '100', estat: 'Vinc', instant: '15/01/2020 20:00:00' }),
      ]);

      const events: SyncEvent[] = [];
      const sub = { next: (e: SyncEvent) => events.push(e) } as unknown as import('rxjs').Subscriber<SyncEvent>;

      await strategy.syncAll(sub, [event]);

      expect(legacyApiClient.getAssistenciesXlsx).toHaveBeenCalledWith('42');
      expect(attendanceRepository.upsert).toHaveBeenCalledTimes(1);
      const upserted = attendanceRepository.upsert.mock.calls[0][0];
      expect(upserted.status).toBe(AttendanceStatus.ASSISTIT);
      expect(upserted).not.toHaveProperty('isLateCancel');
    });

    it('counts lateCancel in summary for No vinc within 6h of past event', async () => {
      const person = makePerson('200');
      const event = makeEvent({
        date: new Date('2020-01-15'),
        startTime: '18:45',
        eventType: EventType.ASSAIG,
      });

      const storedAttendance = {
        status: AttendanceStatus.NO_VAIG,
        respondedAt: new Date('2020-01-15T16:00:00'), // 2h45m before = within 6h
        person: { isXicalla: false },
      };
      personRepository.find.mockResolvedValue([person]);
      (legacyApiClient.getAssistenciesXlsx as jest.Mock).mockResolvedValue([
        makeRow({ legacyPersonId: '200', estat: 'No vinc', instant: '15/01/2020 16:00:00' }),
      ]);
      attendanceRepository.find.mockResolvedValue([storedAttendance]);

      const sub = { next: jest.fn() } as unknown as import('rxjs').Subscriber<SyncEvent>;
      await strategy.syncAll(sub, [event]);

      const upserted = attendanceRepository.upsert.mock.calls[0][0];
      expect(upserted.status).toBe(AttendanceStatus.NO_VAIG);
      expect(upserted).not.toHaveProperty('isLateCancel'); // not stored per-row

      const summary = eventRepository.update.mock.calls[0][1].attendanceSummary;
      expect(summary.lateCancel).toBe(1);
    });

    it('skips unmatched legacyPersonId and counts as unmatched', async () => {
      const event = makeEvent();
      personRepository.find.mockResolvedValue([]); // no persons in DB
      (legacyApiClient.getAssistenciesXlsx as jest.Mock).mockResolvedValue([
        makeRow({ legacyPersonId: '999' }),
      ]);

      const events: SyncEvent[] = [];
      const sub = { next: (e: SyncEvent) => events.push(e) } as unknown as import('rxjs').Subscriber<SyncEvent>;
      await strategy.syncAll(sub, [event]);

      expect(attendanceRepository.upsert).not.toHaveBeenCalled();
      const progressMsg = events.find((e) => e.current === 1);
      expect(progressMsg?.message).toContain('sense match');
    });

    it('does not overwrite user-edited notes on re-sync', async () => {
      const person = makePerson('100');
      const event = makeEvent();
      personRepository.find.mockResolvedValue([person]);
      (legacyApiClient.getAssistenciesXlsx as jest.Mock).mockResolvedValue([
        makeRow({ legacyPersonId: '100', notes: 'legacy note', estat: 'Vinc' }),
      ]);

      const sub = { next: jest.fn() } as unknown as import('rxjs').Subscriber<SyncEvent>;
      await strategy.syncAll(sub, [event]);

      // upsert should NOT include notes
      const upserted = attendanceRepository.upsert.mock.calls[0][0];
      expect(upserted).not.toHaveProperty('notes');
      // notes only set via updateNotesOnCreate with WHERE notes IS NULL
      expect(mockUpdateQueryBuilder.where).toHaveBeenCalledWith(
        expect.stringContaining('notes IS NULL'),
        expect.any(Object),
      );
    });
  });
});
