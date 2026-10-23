import { InjectionToken, Signal, inject, signal } from '@angular/core';
import { CollaSettings, DEFAULT_COLLA_SETTINGS } from '@muixer/shared';

/** The colla settings figure rendering reads: relative heights and tronc height warnings. */
export type PinyesRenderSettings = Pick<CollaSettings, 'shoulderHeightBaselineCm' | 'troncHeightThresholds'>;

/**
 * Each app provides its stored colla settings here (`useFactory` from its settings service);
 * left unprovided, rendering uses the defaults.
 */
export const PINYES_RENDER_SETTINGS = new InjectionToken<Signal<PinyesRenderSettings>>('PINYES_RENDER_SETTINGS', {
  providedIn: 'root',
  factory: () =>
    signal<PinyesRenderSettings>({
      shoulderHeightBaselineCm: DEFAULT_COLLA_SETTINGS.shoulderHeightBaselineCm,
      troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds,
    }).asReadonly(),
});

/** The render settings, changing when the app's do. Call it in an injection context. */
export function injectPinyesRenderSettings(): Signal<PinyesRenderSettings> {
  return inject(PINYES_RENDER_SETTINGS);
}
