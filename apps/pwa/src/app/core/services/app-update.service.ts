import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SwUpdate } from '@angular/service-worker';

/**
 * Surfaces a new deploy to an installed app that may stay open (or suspended, on iOS) for days.
 * Angular's service worker downloads the new version in the background but only serves it on the
 * next cold start; this flags it so the user can switch now, and re-checks whenever the app comes
 * back to the foreground — the moment an iOS user "reopens" a suspended PWA.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdateService {
  private readonly sw = inject(SwUpdate);

  private readonly _updateReady = signal(false);
  readonly updateReady = this._updateReady.asReadonly();

  constructor() {
    if (!this.sw.isEnabled) return;

    this.sw.versionUpdates.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'VERSION_READY') this._updateReady.set(true);
    });
    // The cached version lost files the server no longer has: only a reload recovers.
    this.sw.unrecoverable.pipe(takeUntilDestroyed()).subscribe(() => this.reload());

    const onVisible = () => {
      if (document.visibilityState === 'visible') void this.sw.checkForUpdate().catch(() => false);
    };
    document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
  }

  async update(): Promise<void> {
    // A failed activation still reloads: a cold start serves the newest version anyway.
    await this.sw.activateUpdate().catch(() => false);
    this.reload();
  }

  reload(): void {
    document.location.reload();
  }
}
