import { DOCUMENT, DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import type { ThemeMode } from '../tokens/color';
import { THEME_NAMES, THEME_STORAGE_KEY } from '../tokens/theme-names';

export type ThemePreference = 'system' | ThemeMode;

const PREFERENCES: readonly ThemePreference[] = ['system', 'light', 'dark'];

/**
 * Per-device light/dark preference. "system" leaves `<html>` without `data-theme`, so DaisyUI's
 * own `prefers-color-scheme` media block picks the theme in pure CSS; an explicit choice sets
 * `data-theme` on `<html>`. index.html applies a stored choice before Angular boots, so there's
 * no light flash on load — this service only has to keep it in sync after that.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly root = inject(DOCUMENT).documentElement;
  private readonly media = inject(DOCUMENT).defaultView?.matchMedia?.('(prefers-color-scheme: dark)') ?? null;

  private readonly _preference = signal<ThemePreference>(readStoredPreference());
  readonly preference = this._preference.asReadonly();

  private readonly systemPrefersDark = signal(this.media?.matches ?? false);

  /** The mode actually on screen. */
  readonly mode = computed<ThemeMode>(() => {
    const preference = this._preference();
    if (preference !== 'system') return preference;
    return this.systemPrefersDark() ? 'dark' : 'light';
  });

  constructor() {
    const onSystemChange = (event: { matches: boolean }) => this.systemPrefersDark.set(event.matches);
    this.media?.addEventListener('change', onSystemChange);
    inject(DestroyRef).onDestroy(() => this.media?.removeEventListener('change', onSystemChange));
    this.apply(this._preference());
  }

  setPreference(preference: ThemePreference): void {
    this._preference.set(preference);
    try {
      if (preference === 'system') localStorage.removeItem(THEME_STORAGE_KEY);
      else localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // Storage blocked (private mode): the choice still applies for this visit.
    }
    this.apply(preference);
  }

  private apply(preference: ThemePreference): void {
    if (preference === 'system') delete this.root.dataset['theme'];
    else this.root.dataset['theme'] = THEME_NAMES[preference];
  }
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return PREFERENCES.includes(stored as ThemePreference) ? (stored as ThemePreference) : 'system';
  } catch {
    return 'system';
  }
}
