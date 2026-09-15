import { TestBed } from '@angular/core/testing';
import { pollTick } from './poll-tick.util';

describe('pollTick', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('increments on each interval tick', () => {
    const tick = TestBed.runInInjectionContext(() => pollTick(1000));

    expect(tick()).toBe(0);
    vi.advanceTimersByTime(1000);
    expect(tick()).toBe(1);
    vi.advanceTimersByTime(2000);
    expect(tick()).toBe(3);
  });

  it('stops ticking once the injection context is destroyed', () => {
    TestBed.runInInjectionContext(() => pollTick(1000));
    TestBed.resetTestingModule();

    expect(() => vi.advanceTimersByTime(5000)).not.toThrow();
  });
});
