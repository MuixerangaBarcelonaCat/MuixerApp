import { fetchTroncFloors } from './tronc-floors.util';

describe('fetchTroncFloors', () => {
  const query = jest.fn();
  const dataSource = { query } as any;

  beforeEach(() => query.mockReset());

  it('scopes the query to an event', async () => {
    query.mockResolvedValueOnce([]);

    await fetchTroncFloors(dataSource, { eventId: 'ev-1' });

    expect(query.mock.calls[0][0]).toContain('es."eventId" = $1');
    expect(query.mock.calls[0][1]).toEqual(['ev-1']);
  });

  it('scopes the query to a set of instances', async () => {
    query.mockResolvedValueOnce([]);

    await fetchTroncFloors(dataSource, { instanceIds: ['inst-1', 'inst-2'] });

    expect(query.mock.calls[0][0]).toContain('in_."figureInstanceId" = ANY($1)');
    expect(query.mock.calls[0][1]).toEqual([['inst-1', 'inst-2']]);
  });

  it('skips the query when there are no instances', async () => {
    const result = await fetchTroncFloors(dataSource, { instanceIds: [] });

    expect(query).not.toHaveBeenCalled();
    expect(result.size).toBe(0);
  });

  it('groups rows per instance into floors, base first, with climb indicators', async () => {
    query.mockResolvedValueOnce([
      { instance_id: 'inst-1', zone: 'TRONC', z: 2, sort_order: 0, alias: null, climb_indicator: null },
      { instance_id: 'inst-1', zone: 'BASE', z: 0, sort_order: 0, alias: 'Pepet', climb_indicator: null },
      { instance_id: 'inst-1', zone: 'TRONC', z: 1, sort_order: 0, alias: 'Maria', climb_indicator: 'D' },
      { instance_id: 'inst-2', zone: 'TRONC', z: 1, sort_order: 0, alias: null, climb_indicator: 'E' },
    ]);

    const result = await fetchTroncFloors(dataSource, { instanceIds: ['inst-1', 'inst-2'] });

    expect(result.get('inst-1')).toEqual([
      { z: 0, isBase: true, slots: ['Pepet'] },
      { z: 1, isBase: false, slots: ['Maria (D)'] },
      { z: 2, isBase: false, slots: [null] },
    ]);
    expect(result.get('inst-2')).toEqual([{ z: 1, isBase: false, slots: ['? (E)'] }]);
  });
});
