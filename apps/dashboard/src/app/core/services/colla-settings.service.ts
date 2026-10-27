import { Injectable, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Observable, tap } from 'rxjs';
import { CollaSettings, DEFAULT_COLLA_SETTINGS, UpdateCollaSettings } from '@muixer/shared';
import { PinyesRenderSettings } from '@muixer/pinyes-render/settings';
import { AuthService } from '../auth/services/auth.service';
import { ApiService } from './api.service';

/**
 * The colla's settings (`/colla-settings`), read once signed in. Until they arrive, or when they
 * can't be read, every consumer gets `DEFAULT_COLLA_SETTINGS`.
 */
@Injectable({ providedIn: 'root' })
export class CollaSettingsService extends ApiService {
  private readonly auth = inject(AuthService);

  private readonly stored = rxResource({
    params: () => (this.auth.isAuthenticated() ? {} : undefined),
    stream: () => this.get<CollaSettings>('/colla-settings'),
  });

  /** The stored settings have arrived (`settings` is no longer the defaults standing in). */
  readonly loaded = computed(() => this.stored.hasValue());
  readonly loadFailed = computed(() => !!this.stored.error());

  readonly settings = computed<CollaSettings>(() =>
    this.stored.hasValue() ? this.stored.value() : DEFAULT_COLLA_SETTINGS,
  );

  /** What figure rendering reads; provided to `@muixer/pinyes-render` as `PINYES_RENDER_SETTINGS`. */
  readonly renderSettings = computed<PinyesRenderSettings>(() => {
    const { shoulderHeightBaselineCm, troncHeightThresholds } = this.settings();
    return { shoulderHeightBaselineCm, troncHeightThresholds };
  });

  update(patch: UpdateCollaSettings): Observable<CollaSettings> {
    return this.patch<CollaSettings>('/colla-settings', patch).pipe(tap((saved) => this.stored.set(saved)));
  }
}
