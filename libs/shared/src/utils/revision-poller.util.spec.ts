import { createRevisionPoller, VisibilitySource } from './revision-poller.util';

class FakeVisibility implements VisibilitySource {
  visibilityState = 'visible';
  private listeners = new Set<() => void>();
  addEventListener(_: 'visibilitychange', l: () => void) {
    this.listeners.add(l);
  }
  removeEventListener(_: 'visibilitychange', l: () => void) {
    this.listeners.delete(l);
  }
  get listenerCount() {
    return this.listeners.size;
  }
  setVisible(visible: boolean) {
    this.visibilityState = visible ? 'visible' : 'hidden';
    [...this.listeners].forEach((l) => l());
  }
}

const flush = () => jest.advanceTimersByTimeAsync(0);

describe('createRevisionPoller', () => {
  let visibility: FakeVisibility;
  let values: number[];
  let fetch: jest.Mock;
  let onChange: jest.Mock;

  const make = (extra: Record<string, unknown> = {}) =>
    createRevisionPoller<number>({
      fetch,
      onChange,
      intervalMs: 1000,
      visibility,
      ...extra,
    });

  beforeEach(() => {
    jest.useFakeTimers();
    visibility = new FakeVisibility();
    values = [1];
    fetch = jest.fn(async () => values[Math.min(fetch.mock.calls.length - 1, values.length - 1)]);
    onChange = jest.fn();
  });
  afterEach(() => jest.useRealTimers());

  it('fetches immediately on start and does not call onChange for the first value', async () => {
    make().start();
    await flush();
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(next, previous) when a later value differs', async () => {
    values = [1, 2];
    make().start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledWith(2, 1);
  });

  it('does not call onChange when the value is equal', async () => {
    values = [1, 1];
    make().start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('waits intervalMs + random()*jitterMs between polls', async () => {
    make({ jitterMs: 5000, random: () => 0.5 }).start();
    await flush();
    await jest.advanceTimersByTimeAsync(3499);
    expect(fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('waits intervalMs + jitter (32 500 ms for the PWA values)', async () => {
    createRevisionPoller<number>({
      fetch,
      onChange,
      intervalMs: 30_000,
      jitterMs: 5000,
      random: () => 0.5,
      visibility,
    }).start();
    await flush();
    await jest.advanceTimersByTimeAsync(32_499);
    expect(fetch).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('never overlaps two fetches when a fetch outlasts the interval', async () => {
    let resolve!: (v: number) => void;
    fetch.mockImplementation(() => new Promise<number>((r) => (resolve = r)));
    make().start();
    await jest.advanceTimersByTimeAsync(5000);
    expect(fetch).toHaveBeenCalledTimes(1);
    resolve(1);
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('skips the fetch while paused and resumes on the next tick', async () => {
    let paused = true;
    make({ isPaused: () => paused }).start();
    await jest.advanceTimersByTimeAsync(2500);
    expect(fetch).not.toHaveBeenCalled();
    paused = false;
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not fetch while hidden and has no pending timer', async () => {
    make().start();
    await flush();
    visibility.setVisible(false);
    expect(jest.getTimerCount()).toBe(0);
    await jest.advanceTimersByTimeAsync(10_000);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('fetches once, immediately, when becoming visible again', async () => {
    make().start();
    await flush();
    visibility.setVisible(false);
    visibility.setVisible(true);
    await flush();
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('ignores a rejected fetch, keeps the baseline and keeps polling', async () => {
    fetch
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(2);
    make().start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(onChange).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1000);
    expect(onChange).toHaveBeenCalledWith(2, 1);
  });

  it('keeps the previous baseline when onChange resolves false', async () => {
    fetch.mockResolvedValueOnce(1).mockResolvedValue(2);
    onChange.mockResolvedValue(false);
    make().start();
    await jest.advanceTimersByTimeAsync(2000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(2, 1);
  });

  it('keeps the previous baseline when onChange throws', async () => {
    fetch.mockResolvedValueOnce(1).mockResolvedValue(2);
    onChange.mockRejectedValue(new Error('boom'));
    make().start();
    await jest.advanceTimersByTimeAsync(2000);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(2, 1);
  });

  it('stop() cancels the timer, removes the listener and ignores an in-flight result', async () => {
    let resolve!: (v: number) => void;
    fetch.mockResolvedValueOnce(1).mockImplementationOnce(() => new Promise<number>((r) => (resolve = r)));
    const poller = make();
    poller.start();
    await jest.advanceTimersByTimeAsync(1000);
    poller.stop();
    resolve(2);
    await flush();
    expect(onChange).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(visibility.listenerCount).toBe(0);
  });

  it('start() twice does not double the polling', async () => {
    const poller = make();
    poller.start();
    poller.start();
    await jest.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(visibility.listenerCount).toBe(1);
  });
});
