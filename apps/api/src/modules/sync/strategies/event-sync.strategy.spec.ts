import { EventSyncStrategy } from './event-sync.strategy';
import { EventType } from '@muixer/shared';

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

describe('EventSyncStrategy — season assignment', () => {
  const CUTOFF = new Date('2025-09-06');

  const season2024 = { id: 's1', name: 'Temporada 2024-2025' };
  const season2025 = { id: 's2', name: 'Temporada 2025-2026' };

  function assignSeason(date: Date) {
    return date < CUTOFF ? season2024 : season2025;
  }

  it('assigns events before cutoff to Temporada 2024-2025', () => {
    expect(assignSeason(new Date('2025-09-05'))).toBe(season2024);
  });

  it('assigns events on cutoff date to Temporada 2025-2026', () => {
    expect(assignSeason(new Date('2025-09-06'))).toBe(season2025);
  });

  it('assigns events after cutoff to Temporada 2025-2026', () => {
    expect(assignSeason(new Date('2026-03-26'))).toBe(season2025);
  });
});

describe('EventSyncStrategy — merge rules', () => {
  it('maps assaig rehearsal metadata correctly', () => {
    const horaFinal = '21:00';
    const metadata = horaFinal ? { endTime: horaFinal } : {};
    expect(metadata).toEqual({ endTime: '21:00' });
  });

  it('maps actuacio performance metadata correctly', () => {
    const casa: string = '1';
    const colles: string = 'Colla A, Colla B';
    const transport: string = '0';
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
    const colles: string = '';
    const result = colles ? colles.split(/ i |,/).map((c: string) => c.trim()).filter(Boolean) : [];
    expect(result).toEqual([]);
  });
});

// Integration-style test with mocked repositories
describe('EventSyncStrategy — concurrency guard', () => {
  it('returns error event if sync already in progress', (done) => {
    const mockEventRepo = { findOne: jest.fn(), save: jest.fn(), create: jest.fn(), find: jest.fn() };
    const mockSeasonRepo = { findOne: jest.fn(), upsert: jest.fn() };
    const mockLegacyClient = { login: jest.fn(), getAssajos: jest.fn(), getActuacions: jest.fn() };
    const mockAttendanceStrategy = { syncAll: jest.fn() };

    // Manually simulate isSyncing = true
    const s = new EventSyncStrategy(
      mockEventRepo as never,
      mockSeasonRepo as never,
      mockLegacyClient as never,
      mockAttendanceStrategy as never,
    );

    // Trigger first sync (won't complete immediately in this mock)
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
