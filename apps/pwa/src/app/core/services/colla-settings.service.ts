import { Injectable, computed, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';
import { tap } from 'rxjs';
import { CollaSettings, DEFAULT_COLLA_SETTINGS, PublicCollaSettings } from '@muixer/shared';
import { PinyesRenderSettings } from '@muixer/pinyes-render/settings';
import { AuthService } from '../auth/services/auth.service';
import { environment } from '../../../environments/environment';

/** Where the last colla name read is kept, so the login screen can show it offline. */
export const COLLA_NAME_STORAGE_KEY = 'muixer_colla_name';

function readCachedName(): string | null {
  try {
    return localStorage.getItem(COLLA_NAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

function cacheName(name: string): void {
  try {
    localStorage.setItem(COLLA_NAME_STORAGE_KEY, name);
  } catch {
    // localStorage unavailable (private mode): the name just won't be remembered.
  }
}

/**
 * The colla's settings (`/colla-settings`), read once signed in; until then, or when they can't be
 * read, `DEFAULT_COLLA_SETTINGS`. The colla name is public (the login screen shows it).
 */
@Injectable({ providedIn: 'root' })
export class CollaSettingsService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = `${environment.apiUrl}/colla-settings`;
  private readonly cachedName = readCachedName();

  private readonly stored = rxResource({
    params: () => (this.auth.isAuthenticated() ? {} : undefined),
    stream: () => this.http.get<CollaSettings>(this.baseUrl),
  });

  private readonly publicSettings = rxResource({
    stream: () =>
      this.http.get<PublicCollaSettings>(`${this.baseUrl}/public`).pipe(tap(({ collaName }) => cacheName(collaName))),
  });

  readonly settings = computed<CollaSettings>(() =>
    this.stored.hasValue() ? this.stored.value() : DEFAULT_COLLA_SETTINGS,
  );

  /** What figure rendering reads; provided to `@muixer/pinyes-render` as `PINYES_RENDER_SETTINGS`. */
  readonly renderSettings = computed<PinyesRenderSettings>(() => {
    const { shoulderHeightBaselineCm, troncHeightThresholds } = this.settings();
    return { shoulderHeightBaselineCm, troncHeightThresholds };
  });

  /** `null` until known: never shown as a default that may belong to another colla. */
  readonly collaName = computed<string | null>(() =>
    this.publicSettings.hasValue() ? this.publicSettings.value().collaName : this.cachedName,
  );
}
