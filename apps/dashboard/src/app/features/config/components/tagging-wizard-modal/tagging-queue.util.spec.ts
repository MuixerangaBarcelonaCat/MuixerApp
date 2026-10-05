import { TagCategory } from '@muixer/shared';
import { Person, Position } from '../../../persons/models/person.model';
import { advance, isTagCompliant } from './tagging-queue.util';

const pos = (category: TagCategory, id: string = category): Position => ({
  id,
  name: id,
  slug: id,
  zone: null,
  color: '#000000',
  category,
});

const person = (id: string, positions: Position[] = []): Person => ({ id, positions }) as Person;

describe('tagging-queue.util', () => {
  describe('isTagCompliant', () => {
    it('is false with no tags', () => {
      expect(isTagCompliant(person('a'))).toBe(false);
    });
    it('is false with only PINYA', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.PINYA)]))).toBe(false);
    });
    it('is true with PINYA and TRONC', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.PINYA), pos(TagCategory.TRONC)]))).toBe(true);
    });
    it('is true with XICALLA alone', () => {
      expect(isTagCompliant(person('a', [pos(TagCategory.XICALLA)]))).toBe(true);
    });
  });

  describe('advance', () => {
    const ok = [pos(TagCategory.XICALLA)];

    it('moves forward and keeps everyone in all mode', () => {
      const list = [person('a', ok), person('b')];
      expect(advance(list, 0, 1, 'all')).toEqual({ people: list, index: 1 });
    });

    it('drops the person left behind when now compliant in pending mode', () => {
      const list = [person('a', ok), person('b'), person('c')];
      const r = advance(list, 0, 1, 'pending');
      expect(r.people.map((p) => p.id)).toEqual(['b', 'c']);
      expect(r.index).toBe(0);
    });

    it('keeps the person left behind when still pending', () => {
      const list = [person('a'), person('b')];
      expect(advance(list, 0, 1, 'pending')).toEqual({ people: list, index: 1 });
    });

    it('drops the compliant person when going back', () => {
      const list = [person('a'), person('b', ok)];
      const r = advance(list, 1, -1, 'pending');
      expect(r.people.map((p) => p.id)).toEqual(['a']);
      expect(r.index).toBe(0);
    });

    it('does not move past the end, even if the last person is compliant', () => {
      const list = [person('a'), person('b', ok)];
      expect(advance(list, 1, 1, 'pending')).toEqual({ people: list, index: 1 });
    });

    it('does not move before the start', () => {
      const list = [person('a')];
      expect(advance(list, 0, -1, 'pending')).toEqual({ people: list, index: 0 });
    });
  });
});
