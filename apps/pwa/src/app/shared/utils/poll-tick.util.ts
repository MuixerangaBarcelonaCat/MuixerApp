import { DestroyRef, inject, signal, Signal } from '@angular/core';

/**
 * Signal that increments every `intervalMs`. Include it in an `rxResource`'s `params` (alongside
 * the resource's real params) to force a periodic refetch — `rxResource` re-runs `stream` whenever
 * `params` changes. Must be called from an injection context (e.g. a component field initializer).
 */
export function pollTick(intervalMs: number): Signal<number> {
  const tick = signal(0);
  const id = setInterval(() => tick.update((n) => n + 1), intervalMs);
  inject(DestroyRef).onDestroy(() => clearInterval(id));
  return tick;
}
