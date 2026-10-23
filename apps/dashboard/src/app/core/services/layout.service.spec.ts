import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutService } from './layout.service';

type ChangeListener = (e: { matches: boolean }) => void;

const TOUCH_QUERY = '(pointer: coarse)';
const PHONE_QUERY = '(max-width: 639.98px)';

/** One media query list per query, so the touch and phone listeners don't overwrite each other. */
const stubMatchMedia = (initial: boolean | Record<string, boolean>) => {
  const listeners = new Map<string, ChangeListener>();
  const removeEventListener = vi.fn();
  const matchMedia = vi.fn((query: string) => ({
    matches: typeof initial === 'boolean' ? initial : (initial[query] ?? false),
    addEventListener: vi.fn((_: string, l: ChangeListener) => listeners.set(query, l)),
    removeEventListener,
  }));
  vi.stubGlobal('matchMedia', matchMedia);
  return {
    matchMedia,
    removeEventListener,
    emit: (matches: boolean, query = TOUCH_QUERY) => listeners.get(query)?.({ matches }),
  };
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

      expect(matchMedia).toHaveBeenCalledWith(TOUCH_QUERY);
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

  describe('isPhone', () => {
    it('is false when matchMedia is unavailable', () => {
      vi.stubGlobal('matchMedia', undefined);

      expect(TestBed.inject(LayoutService).isPhone()).toBe(false);
    });

    it('is true below the sm breakpoint, whatever the pointer', () => {
      stubMatchMedia({ [PHONE_QUERY]: true });

      const service = TestBed.inject(LayoutService);

      expect(service.isPhone()).toBe(true);
      expect(service.isTouch()).toBe(false);
    });

    it('is false on a tablet or desktop width', () => {
      stubMatchMedia({ [TOUCH_QUERY]: true });

      expect(TestBed.inject(LayoutService).isPhone()).toBe(false);
    });

    it('follows the viewport width', () => {
      const { emit } = stubMatchMedia(false);
      const service = TestBed.inject(LayoutService);

      emit(true, PHONE_QUERY);
      expect(service.isPhone()).toBe(true);
      expect(service.isTouch()).toBe(false);

      emit(false, PHONE_QUERY);
      expect(service.isPhone()).toBe(false);
    });

    it('stops listening to both queries when the service is destroyed', () => {
      const { removeEventListener } = stubMatchMedia(false);
      TestBed.inject(LayoutService);

      TestBed.resetTestingModule();

      expect(removeEventListener).toHaveBeenCalledTimes(2);
    });
  });
});
