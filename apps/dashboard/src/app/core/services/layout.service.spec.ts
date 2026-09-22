import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutService } from './layout.service';

type ChangeListener = (e: { matches: boolean }) => void;

const stubMatchMedia = (initialMatches: boolean) => {
  let listener: ChangeListener | null = null;
  const removeEventListener = vi.fn();
  const mql = {
    matches: initialMatches,
    addEventListener: vi.fn((_: string, l: ChangeListener) => (listener = l)),
    removeEventListener,
  };
  const matchMedia = vi.fn().mockReturnValue(mql);
  vi.stubGlobal('matchMedia', matchMedia);
  return { matchMedia, removeEventListener, emit: (matches: boolean) => listener?.({ matches }) };
};

describe('LayoutService', () => {
  const original = window.matchMedia;

  afterEach(() => {
    vi.unstubAllGlobals();
    window.matchMedia = original;
    TestBed.resetTestingModule();
  });

  describe('isFullscreen', () => {
    it('toggles with requestFullscreen / exitFullscreen', () => {
      const service = TestBed.inject(LayoutService);

      service.requestFullscreen();
      expect(service.isFullscreen()).toBe(true);

      service.exitFullscreen();
      expect(service.isFullscreen()).toBe(false);
    });
  });

  describe('isTouch', () => {
    it('is false when matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);

      expect(TestBed.inject(LayoutService).isTouch()).toBe(false);
    });

    it('asks whether the primary pointer is coarse', () => {
      const { matchMedia } = stubMatchMedia(false);

      TestBed.inject(LayoutService);

      expect(matchMedia).toHaveBeenCalledWith('(pointer: coarse)');
    });

    it('is true when the primary pointer is coarse (phone / tablet)', () => {
      stubMatchMedia(true);

      expect(TestBed.inject(LayoutService).isTouch()).toBe(true);
    });

    it('is false when the primary pointer is fine (mouse)', () => {
      stubMatchMedia(false);

      expect(TestBed.inject(LayoutService).isTouch()).toBe(false);
    });

    it('follows changes of the primary pointer', () => {
      const { emit } = stubMatchMedia(false);
      const service = TestBed.inject(LayoutService);

      emit(true);
      expect(service.isTouch()).toBe(true);

      emit(false);
      expect(service.isTouch()).toBe(false);
    });

    it('stops listening when the service is destroyed', () => {
      const { removeEventListener } = stubMatchMedia(false);
      TestBed.inject(LayoutService);

      TestBed.resetTestingModule();

      expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });
});
