import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AttendanceSyncStrategy } from './attendance-sync.strategy';
import { LegacyApiClient } from '../legacy-api.client';
import { Attendance } from '../../event/attendance.entity';
import { Event } from '../../event/event.entity';
import { Person } from '../../person/person.entity';
import { AttendanceStatus, EventType } from '@muixer/shared';
import { Subject } from 'rxjs';
import { SyncEvent } from '../interfaces/sync-event.interface';

describe('AttendanceSyncStrategy', () => {
  let strategy: AttendanceSyncStrategy;
  let legacyApiClient: jest.Mocked<LegacyApiClient>;
  let attendanceRepository: {
    find: jest.Mock;
    upsert: jest.Mock;
  };
  let eventRepository: {
    update: jest.Mock;
  };
  let personRepository: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };

  const mockPersonQb = {
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn(),
  };

  beforeEach(async () => {
    attendanceRepository = {
      find: jest.fn().mockResolvedValue([]),
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    eventRepository = {
      update: jest.fn().mockResolvedValue(undefined),
    };

    personRepository = {
      createQueryBuilder: jest.fn(() => mockPersonQb),
      findOne: jest.fn(),
    };

    legacyApiClient = {
      getAssistencies: jest.fn(),
    } as unknown as jest.Mocked<LegacyApiClient>;

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

  describe('mapAttendanceStatus', () => {
    describe('past rehearsal (ASSAIG)', () => {
      it('maps Vinc → ASSISTIT', () => {
        expect(strategy.mapAttendanceStatus('Vinc', EventType.ASSAIG, true)).toBe(AttendanceStatus.ASSISTIT);
      });
      it('maps Potser → NO_PRESENTAT', () => {
        expect(strategy.mapAttendanceStatus('Potser', EventType.ASSAIG, true)).toBe(AttendanceStatus.NO_PRESENTAT);
      });
      it('maps No vinc → NO_VAIG', () => {
        expect(strategy.mapAttendanceStatus('No vinc', EventType.ASSAIG, true)).toBe(AttendanceStatus.NO_VAIG);
      });
      it('maps unknown → PENDENT', () => {
        expect(strategy.mapAttendanceStatus('', EventType.ASSAIG, true)).toBe(AttendanceStatus.PENDENT);
      });
    });

    describe('future rehearsal (ASSAIG)', () => {
      it('maps Potser → ANIRE', () => {
        expect(strategy.mapAttendanceStatus('Potser', EventType.ASSAIG, false)).toBe(AttendanceStatus.ANIRE);
      });
      it('maps No vinc → NO_VAIG', () => {
        expect(strategy.mapAttendanceStatus('No vinc', EventType.ASSAIG, false)).toBe(AttendanceStatus.NO_VAIG);
      });
      it('maps Vinc → PENDENT (Vinc not used for rehearsals pre-event)', () => {
        expect(strategy.mapAttendanceStatus('Vinc', EventType.ASSAIG, false)).toBe(AttendanceStatus.PENDENT);
      });
    });

    describe('past performance (ACTUACIO)', () => {
      it('maps Vinc → ASSISTIT', () => {
        expect(strategy.mapAttendanceStatus('Vinc', EventType.ACTUACIO, true)).toBe(AttendanceStatus.ASSISTIT);
      });
      it('maps No vinc → NO_VAIG', () => {
        expect(strategy.mapAttendanceStatus('No vinc', EventType.ACTUACIO, true)).toBe(AttendanceStatus.NO_VAIG);
      });
      it('maps unknown → PENDENT', () => {
        expect(strategy.mapAttendanceStatus('', EventType.ACTUACIO, true)).toBe(AttendanceStatus.PENDENT);
      });
    });

    describe('future performance (ACTUACIO)', () => {
      it('maps Vinc → ANIRE', () => {
        expect(strategy.mapAttendanceStatus('Vinc', EventType.ACTUACIO, false)).toBe(AttendanceStatus.ANIRE);
      });
      it('maps No vinc → NO_VAIG', () => {
        expect(strategy.mapAttendanceStatus('No vinc', EventType.ACTUACIO, false)).toBe(AttendanceStatus.NO_VAIG);
      });
      it('maps unknown → PENDENT', () => {
        expect(strategy.mapAttendanceStatus('', EventType.ACTUACIO, false)).toBe(AttendanceStatus.PENDENT);
      });
    });
  });

  describe('parseTimestamp', () => {
    it('parses DD/MM/YYYY HH:MM:SS', () => {
      const result = strategy.parseTimestamp('05/03/2026 12:59:18');
      expect(result).toBeInstanceOf(Date);
      expect(result!.getFullYear()).toBe(2026);
      expect(result!.getMonth()).toBe(2); // March = 2
      expect(result!.getDate()).toBe(5);
    });

    it('returns null for empty string', () => {
      expect(strategy.parseTimestamp('')).toBeNull();
    });

    it('returns null for invalid format', () => {
      expect(strategy.parseTimestamp('invalid')).toBeNull();
    });
  });

  describe('syncAll', () => {
    it('emits progress per event and matches by alias', async () => {
      const mockEvent = {
        id: 'event-uuid',
        legacyId: '1',
        title: 'ASSAIG GENERAL',
        eventType: EventType.ASSAIG,
        date: new Date('2020-01-01'), // past
        startTime: '18:45',
      } as Event;

      const mockPerson = { id: 'person-uuid', alias: 'ADRI', isXicalla: false } as Person;

      legacyApiClient.getAssistencies = jest.fn().mockResolvedValue([
        {
          '0': '',
          id_assistencia: '42',
          nom_casteller: 'ADRI',
          estat: 'Vinc',
          instant: '01/01/2020 20:00:00',
          observacions: '',
          import: '',
          alimentacio: null,
          intolerancies: null,
        },
      ]);

      mockPersonQb.getOne.mockResolvedValue(mockPerson);
      attendanceRepository.find.mockResolvedValue([]);

      const events: SyncEvent[] = [];
      const subject = { next: (e: SyncEvent) => events.push(e) } as unknown as import('rxjs').Subscriber<SyncEvent>;

      await strategy.syncAll(subject, [mockEvent]);

      expect(legacyApiClient.getAssistencies).toHaveBeenCalledWith('1');
      expect(attendanceRepository.upsert).toHaveBeenCalled();
      const upsertCall = attendanceRepository.upsert.mock.calls[0][0];
      expect(upsertCall.status).toBe(AttendanceStatus.ASSISTIT);
      expect(events.some((e) => e.entity === 'attendance')).toBe(true);
    });

    it('skips unmatched persons and emits warning in message', async () => {
      const mockEvent = {
        id: 'event-uuid',
        legacyId: '1',
        title: 'ASSAIG',
        eventType: EventType.ASSAIG,
        date: new Date('2020-01-01'),
        startTime: '18:45',
      } as Event;

      legacyApiClient.getAssistencies = jest.fn().mockResolvedValue([
        { '0': '', id_assistencia: '1', nom_casteller: 'UNKNOWN', estat: 'Vinc', instant: '', observacions: '', import: '', alimentacio: null, intolerancies: null },
      ]);

      mockPersonQb.getOne.mockResolvedValue(null);
      personRepository.findOne.mockResolvedValue(null);
      attendanceRepository.find.mockResolvedValue([]);

      const events: SyncEvent[] = [];
      const subject = { next: (e: SyncEvent) => events.push(e) } as unknown as import('rxjs').Subscriber<SyncEvent>;

      await strategy.syncAll(subject, [mockEvent]);

      expect(attendanceRepository.upsert).not.toHaveBeenCalled();
      const progressMsg = events.find((e) => e.current === 1 && e.entity === 'attendance');
      expect(progressMsg?.message).toContain('sense match');
    });
  });
});
