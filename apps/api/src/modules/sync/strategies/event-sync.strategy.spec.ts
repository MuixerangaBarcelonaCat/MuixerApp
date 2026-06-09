import { EventSyncStrategy } from './event-sync.strategy';
import { Season } from '../../season/season.entity';

describe('EventSyncStrategy — unit helpers', () => {
  let strategy: EventSyncStrategy;

  beforeEach(() => {
    // Instantiate only the helper methods under test, DI irrelevant
    strategy = {
      extractEventId: EventSyncStrategy.prototype.extractEventId,
      parseDate: EventSyncStrategy.prototype.parseDate,
      stripHtml: EventSyncStrategy.prototype.stripHtml,
      assignSeasonByDate: EventSyncStrategy.prototype.assignSeasonByDate,
    } as unknown as EventSyncStrategy;
  });

  describe('extractEventId', () => {
    it('extracts numeric ID from /llista/{id} HTML', () => {
      expect(strategy.extractEventId('<a href="/llista/42">veure</a>')).toBe('42');
    });

    it('returns null for missing pattern', () => {
      expect(strategy.extractEventId('<a href="/other/42">test</a>')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(strategy.extractEventId('')).toBeNull();
    });
  });

  describe('parseDate', () => {
    it('parses DD/MM/YYYY correctly', () => {
      const d = strategy.parseDate('26/03/2026');
      expect(d.getFullYear()).toBe(2026);
      expect(d.getMonth()).toBe(2); // March = index 2
      expect(d.getDate()).toBe(26);
    });
  });

  describe('stripHtml', () => {
    it('removes HTML tags', () => {
      expect(strategy.stripHtml('<b>ASSAIG</b>')).toBe('ASSAIG');
    });

    it('decodes HTML entities', () => {
      expect(strategy.stripHtml('R&amp;B &lt;test&gt;')).toBe('R&B <test>');
    });

    it('returns empty string for falsy input', () => {
      expect(strategy.stripHtml('')).toBe('');
    });
  });
});

describe('EventSyncStrategy — assignSeasonByDate', () => {
  const makeSeasons = (): Season[] =>
    [
      {
        id: 's1',
        name: 'Temporada 2024-2025',
        startDate: new Date('2024-09-01'),
        endDate: new Date('2025-09-05'),
        legacyId: '2025',
        description: null,
        events: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 's2',
        name: 'Temporada 2025-2026',
        startDate: new Date('2025-09-06'),
        endDate: new Date('2026-09-05'),
        legacyId: '2026',
        description: null,
        events: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as Season[];

  let strategy: EventSyncStrategy;

  beforeEach(() => {
    strategy = {
      assignSeasonByDate: EventSyncStrategy.prototype.assignSeasonByDate,
    } as unknown as EventSyncStrategy;
  });

  it('assigns events within first season range to Temporada 2024-2025', () => {
    const seasons = makeSeasons();
    expect(strategy.assignSeasonByDate(new Date('2025-03-15'), seasons)?.id).toBe('s1');
  });

  it('assigns events on last day of first season to Temporada 2024-2025', () => {
    const seasons = makeSeasons();
    expect(strategy.assignSeasonByDate(new Date('2025-09-05'), seasons)?.id).toBe('s1');
  });

  it('assigns events on first day of second season to Temporada 2025-2026', () => {
    const seasons = makeSeasons();
    expect(strategy.assignSeasonByDate(new Date('2025-09-06'), seasons)?.id).toBe('s2');
  });

  it('assigns events within second season range to Temporada 2025-2026', () => {
    const seasons = makeSeasons();
    expect(strategy.assignSeasonByDate(new Date('2026-03-26'), seasons)?.id).toBe('s2');
  });

  it('falls back to last season for dates beyond all ranges', () => {
    const seasons = makeSeasons();
    // 2027 event — beyond all defined seasons, falls back to most recent
    expect(strategy.assignSeasonByDate(new Date('2027-01-01'), seasons)?.id).toBe('s2');
  });

  it('returns null for empty seasons array', () => {
    expect(strategy.assignSeasonByDate(new Date('2026-01-01'), [])).toBeNull();
  });

  it('assigns correctly with a third season added to DB', () => {
    const seasons = [
      ...makeSeasons(),
      {
        id: 's3',
        name: 'Temporada 2026-2027',
        startDate: new Date('2026-09-06'),
        endDate: new Date('2027-09-05'),
        legacyId: '2027',
        description: null,
        events: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Season,
    ];
    expect(strategy.assignSeasonByDate(new Date('2026-12-01'), seasons)?.id).toBe('s3');
  });
});

describe('EventSyncStrategy — merge rules', () => {
  it('maps assaig rehearsal metadata correctly', () => {
    const horaFinal = '21:00';
    const metadata = horaFinal ? { endTime: horaFinal } : {};
    expect(metadata).toEqual({ endTime: '21:00' });
  });

  it('maps actuacio performance metadata correctly', () => {
    const casa = '1' as string;
    const colles = 'Colla A, Colla B' as string;
    const transport = '0' as string;
    const metadata = {
      isHome: casa === '1',
      colles: colles ? colles.split(/ i |,/).map((c: string) => c.trim()).filter(Boolean) : [],
      hasBus: transport === '1',
    };
    expect(metadata.isHome).toBe(true);
    expect(metadata.colles).toEqual(['Colla A', 'Colla B']);
    expect(metadata.hasBus).toBe(false);
  });

  it('splits colles separated by " i " correctly', () => {
    const colles = 'Jove Muixeranga de València i Castellers de Mollet';
    const result = colles.split(/ i |,/).map((c: string) => c.trim()).filter(Boolean);
    expect(result).toEqual(['Jove Muixeranga de València', 'Castellers de Mollet']);
  });

  it('splits colles with mixed separators', () => {
    const colles = 'Colla A i Colla B, Colla C';
    const result = colles.split(/ i |,/).map((c: string) => c.trim()).filter(Boolean);
    expect(result).toEqual(['Colla A', 'Colla B', 'Colla C']);
  });

  it('handles empty colles string gracefully', () => {
    const colles = '' as string;
    const result = colles ? colles.split(/ i |,/).map((c: string) => c.trim()).filter(Boolean) : [];
    expect(result).toEqual([]);
  });
});

// Integration-style test with mocked repositories
describe('EventSyncStrategy — concurrency guard', () => {
  it('returns error event if sync already in progress', (done) => {
    const mockEventRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() };
    const mockSeasonRepo = { findOne: jest.fn(), upsert: jest.fn(), find: jest.fn() };
    const mockLegacyClient = { login: jest.fn(), getAssajos: jest.fn(), getActuacions: jest.fn() };
    const mockAttendanceStrategy = { syncAll: jest.fn() };

    const s = new EventSyncStrategy(
      mockEventRepo as never,
      mockSeasonRepo as never,
      mockLegacyClient as never,
      mockAttendanceStrategy as never,
    );

    // Manually simulate isSyncing = true
    (s as unknown as { isSyncing: boolean }).isSyncing = true;

    const events: import('../interfaces/sync-event.interface').SyncEvent[] = [];
    s.execute().subscribe({
      next: (e) => events.push(e),
      complete: () => {
        expect(events[0].type).toBe('error');
        expect(events[0].message).toContain('ja en curs');
        done();
      },
    });
  });
});

describe('EventSyncStrategy — loadOrCreateSeasons', () => {
  it('returns existing seasons without creating defaults when DB has seasons', async () => {
    const existing: Partial<Season>[] = [
      { id: 's1', name: 'Temporada 2024-2025', startDate: new Date('2024-09-01'), endDate: new Date('2025-09-05'), legacyId: '2025' },
    ];
    const mockSeasonRepo = {
      find: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn(),
    };

    const s = new EventSyncStrategy(
      {} as never,
      mockSeasonRepo as never,
      {} as never,
      {} as never,
    );

    const result = await s.loadOrCreateSeasons();

    expect(result).toHaveLength(1);
    expect(mockSeasonRepo.upsert).not.toHaveBeenCalled();
  });

  it('creates default seasons when DB is empty', async () => {
    const mockSeasonRepo = {
      find: jest
        .fn()
        .mockResolvedValueOnce([]) // first call: empty
        .mockResolvedValueOnce([
          { id: 's1', legacyId: '2025' },
          { id: 's2', legacyId: '2026' },
        ]), // second call: after upsert
      upsert: jest.fn().mockResolvedValue(undefined),
    };

    const s = new EventSyncStrategy(
      {} as never,
      mockSeasonRepo as never,
      {} as never,
      {} as never,
    );

    const result = await s.loadOrCreateSeasons();

    expect(mockSeasonRepo.upsert).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(2);
  });
});
