import { NewsStatus } from '@muixer/shared';
import {
  getNewsStatus,
  getNewsStatusLabel,
  toDatetimeLocalValue,
  fromDatetimeLocalValue,
} from './news.util';

describe('news.util', () => {
  describe('getNewsStatus', () => {
    it('returns DRAFT when publishedAt is null', () => {
      expect(getNewsStatus({ publishedAt: null })).toBe(NewsStatus.DRAFT);
    });

    it('returns SCHEDULED when publishedAt is in the future', () => {
      const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      expect(getNewsStatus({ publishedAt: future })).toBe(NewsStatus.SCHEDULED);
    });

    it('returns PUBLISHED when publishedAt is in the past', () => {
      const past = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      expect(getNewsStatus({ publishedAt: past })).toBe(NewsStatus.PUBLISHED);
    });
  });

  describe('getNewsStatusLabel', () => {
    it('labels DRAFT as Esborrany', () => {
      expect(getNewsStatusLabel(NewsStatus.DRAFT)).toBe('Esborrany');
    });

    it('labels SCHEDULED as Programada', () => {
      expect(getNewsStatusLabel(NewsStatus.SCHEDULED)).toBe('Programada');
    });

    it('labels PUBLISHED as Publicada', () => {
      expect(getNewsStatusLabel(NewsStatus.PUBLISHED)).toBe('Publicada');
    });
  });

  describe('toDatetimeLocalValue / fromDatetimeLocalValue', () => {
    it('toDatetimeLocalValue returns an empty string for null', () => {
      expect(toDatetimeLocalValue(null)).toBe('');
    });

    it('fromDatetimeLocalValue returns null for an empty string', () => {
      expect(fromDatetimeLocalValue('')).toBeNull();
    });

    it('fromDatetimeLocalValue parses a datetime-local value into an ISO string', () => {
      expect(fromDatetimeLocalValue('2026-01-01T10:30')).toBe(new Date('2026-01-01T10:30').toISOString());
    });

    it('round-trips an ISO date through toDatetimeLocalValue and back', () => {
      const iso = new Date(2026, 0, 1, 10, 30, 0, 0).toISOString();
      const local = toDatetimeLocalValue(iso);
      expect(fromDatetimeLocalValue(local)).toBe(iso);
    });
  });
});
