export const DASHBOARD_REVISION_POLL_MS = 3_000;
export const PWA_REVISION_POLL_MS = 30_000;
export const PWA_REVISION_JITTER_MS = 5_000;

/** The slice of `document` the poller needs (kept structural: libs/shared has no DOM lib). */
export interface VisibilitySource {
  readonly visibilityState: string;
  addEventListener(type: 'visibilitychange', listener: () => void): void;
  removeEventListener(type: 'visibilitychange', listener: () => void): void;
}

export interface RevisionPollerOptions<T> {
  /** Reads the current revision. A rejection is ignored and retried on the next tick. */
  fetch: () => Promise<T>;
  /** Called when the revision differs from the last accepted one. Resolve `false` to keep the
   *  previous baseline (the change was not applied) so the next tick reports it again. */
  onChange: (next: T, previous: T) => boolean | void | Promise<boolean | void>;
  intervalMs: number;
  /** Extra random delay in [0, jitterMs) added to every wait. Default 0. */
  jitterMs?: number;
  /** While it returns true a tick fetches nothing and only schedules the next one. */
  isPaused?: () => boolean;
  /** Default: deep equality via JSON.stringify. */
  isEqual?: (a: T, b: T) => boolean;
  visibility: VisibilitySource;
  random?: () => number;
}

export interface RevisionPoller {
  start(): void;
  stop(): void;
}

export function createRevisionPoller<T>(options: RevisionPollerOptions<T>): RevisionPoller {
  const { fetch, onChange, intervalMs, visibility } = options;
  const jitterMs = options.jitterMs ?? 0;
  const random = options.random ?? Math.random;
  const isEqual = options.isEqual ?? ((a: T, b: T) => JSON.stringify(a) === JSON.stringify(b));

  let running = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let baseline: { value: T } | undefined;

  const isVisible = () => visibility.visibilityState === 'visible';

  const clearTimer = () => {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
  };

  const schedule = () => {
    clearTimer();
    if (!running || !isVisible()) return;
    timer = setTimeout(poll, intervalMs + random() * jitterMs);
  };

  async function poll(): Promise<void> {
    timer = undefined;
    if (!running || !isVisible() || inFlight) return;
    if (options.isPaused?.()) return schedule();

    inFlight = true;
    try {
      const next = await fetch();
      if (running) {
        if (!baseline) baseline = { value: next };
        else if (!isEqual(baseline.value, next)) {
          try {
            if ((await onChange(next, baseline.value)) !== false && running) baseline = { value: next };
          } catch {
            // baseline stays: the next tick reports the change again
          }
        }
      }
    } catch {
      // ignored: retried on the next tick
    } finally {
      inFlight = false;
    }
    schedule();
  }

  const onVisibilityChange = () => {
    clearTimer();
    if (isVisible()) void poll();
  };

  return {
    start() {
      if (running) return;
      running = true;
      visibility.addEventListener('visibilitychange', onVisibilityChange);
      void poll();
    },
    stop() {
      running = false;
      clearTimer();
      visibility.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
