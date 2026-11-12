import { TestBed } from '@angular/core/testing';
import { QUADRE_COLUMNS_STORAGE_KEY, QuadreColumnsService } from './quadre-columns.service';

const TAGS = [
  { id: 't-terca', name: 'Terces', slug: 'terca' },
  { id: 't-mans', name: '1es Mans', slug: 'mans' },
  { id: 't-baix', name: 'Baixes', slug: 'baix' },
  { id: 't-vent', name: '1es Vents', slug: 'vent' },
  { id: 't-xicalla', name: 'Xicalla', slug: 'xicalla' },
];

describe('QuadreColumnsService', () => {
  let service: QuadreColumnsService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(QuadreColumnsService);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const ids = () => service.resolve(TAGS).map((c) => c.id);

  it('defaults to the catalog slugs in order, skipping missing ones', () => {
    // segona, alcadora, persona-nova are not in this catalog.
    expect(service.resolve(TAGS)).toEqual([
      { id: 't-mans', name: '1es Mans' },
      { id: 't-baix', name: 'Baixes' },
      { id: 't-terca', name: 'Terces' },
      { id: 't-xicalla', name: 'Xicalla' },
    ]);
  });

  it('respects the stored order', () => {
    service.save(['t-vent', 't-terca']);
    expect(ids()).toEqual(['t-vent', 't-terca']);
  });

  it('drops stored ids that no longer exist', () => {
    service.save(['gone', 't-terca']);
    expect(ids()).toEqual(['t-terca']);
  });

  it('falls back to defaults when every stored id vanished', () => {
    service.save(['gone']);
    expect(ids()).toEqual(['t-mans', 't-baix', 't-terca', 't-xicalla']);
  });

  it('falls back to defaults on corrupt or wrongly shaped data', () => {
    localStorage.setItem(QUADRE_COLUMNS_STORAGE_KEY, '{nope');
    expect(ids()).toEqual(['t-mans', 't-baix', 't-terca', 't-xicalla']);
    localStorage.setItem(QUADRE_COLUMNS_STORAGE_KEY, JSON.stringify([1, 2]));
    expect(ids()).toEqual(['t-mans', 't-baix', 't-terca', 't-xicalla']);
  });

  it('falls back to defaults when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(ids()).toEqual(['t-mans', 't-baix', 't-terca', 't-xicalla']);
  });

  it('does not throw when saving is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => service.save(['t-terca'])).not.toThrow();
  });

  it('reset restores the defaults', () => {
    service.save(['t-vent']);
    service.reset();
    expect(ids()).toEqual(['t-mans', 't-baix', 't-terca', 't-xicalla']);
  });
});
