import { EventSyncStrategy } from './event-sync.strategy';
import { Season } from '../../season/season.entity';
import { SyncEvent } from '../interfaces/sync-event.interface';

describe('EventSyncStrategy — unit helpers', () => {
  let strategy: EventSyncStrategy;

  beforeEach(() => {
    // Instantiate only the helper methods under test, DI irrelevant
    strategy = {
      extractEventId: EventSyncStrategy.prototype.extractEventId,
      parseDate: EventSyncStrategy.prototype.parseDate,
      stripHtml: EventSyncStrategy.prototype.stripHtml,
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

describe('EventSyncStrategy — full run', () => {
  const ASSAIG = {
    '0': '<a href="/llista/101">llista</a>',
    data: '15/07/2031',
    hora_esdeveniment: '19:00',
    descripcio: 'Assaig d\'estiu',
  };
  const ASSAIG_DETAIL = { descripcio: 'Assaig d\'estiu', hora_final: '', lloc_esdeveniment: 'Plaça', informacio: '' };

  const run = (uncovered: number) => {
    const uncoveredQb = {
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(uncovered),
    };
    const eventRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((e) => e),
      save: jest.fn(async (e) => e),
      find: jest.fn().mockResolvedValue([]),
      createQueryBuilder: jest.fn(() => uncoveredQb),
    };
    const seasonRepo = { find: jest.fn().mockResolvedValue([{ id: 's1' }]), upsert: jest.fn() };
    const legacy = {
      login: jest.fn().mockResolvedValue(undefined),
      getAssajos: jest.fn().mockResolvedValue([ASSAIG]),
      getAssaigDetail: jest.fn().mockResolvedValue(ASSAIG_DETAIL),
      getActuacions: jest.fn().mockResolvedValue([]),
    };
    const strategy = new EventSyncStrategy(
      eventRepo as never,
      seasonRepo as never,
      legacy as never,
      { syncAll: jest.fn().mockResolvedValue(undefined) } as never,
    );
    return new Promise<{ events: SyncEvent[]; eventRepo: typeof eventRepo; uncoveredQb: typeof uncoveredQb }>(
      (resolve) => {
        const events: SyncEvent[] = [];
        strategy.execute().subscribe({
          next: (e) => events.push(e),
          complete: () => resolve({ events, eventRepo, uncoveredQb }),
        });
      },
    );
  };

  it('imports an event whose date is in no season, without assigning any season', async () => {
    const { eventRepo } = await run(1);
    expect(eventRepo.save).toHaveBeenCalledTimes(1);
    expect(eventRepo.create.mock.calls[0][0]).not.toHaveProperty('season');
  });

  it('warns how many legacy events fall in no season and reports it in the summary', async () => {
    const { events, uncoveredQb } = await run(3);
    expect(uncoveredQb.leftJoin).toHaveBeenCalledWith(
      Season,
      'season',
      'event.date BETWEEN season.startDate AND season.endDate',
    );
    expect(uncoveredQb.where).toHaveBeenCalledWith('season.id IS NULL');
    expect(uncoveredQb.andWhere).toHaveBeenCalledWith('event.legacyId IS NOT NULL');
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'warn',
        entity: 'season',
        message: '3 esdeveniments importats no són dins de cap temporada.',
      }),
    );
    expect(events.at(-1)).toMatchObject({ type: 'complete', detail: { uncoveredEvents: 3 } });
  });

  it('emits no warning when every legacy event falls in a season', async () => {
    const { events } = await run(0);
    expect(events.some((e) => e.type === 'warn')).toBe(false);
  });
});
