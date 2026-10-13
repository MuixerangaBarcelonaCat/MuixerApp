import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { DEFAULT_COLLA_SETTINGS } from '@muixer/shared';
import { PINYES_RENDER_SETTINGS, PinyesRenderSettings, injectPinyesRenderSettings } from './render-settings';

describe('injectPinyesRenderSettings', () => {
  afterEach(() => TestBed.resetTestingModule());

  it("falls back to the colla defaults when the app provides nothing", () => {
    const settings = TestBed.runInInjectionContext(() => injectPinyesRenderSettings());

    expect(settings()).toEqual({
      shoulderHeightBaselineCm: DEFAULT_COLLA_SETTINGS.shoulderHeightBaselineCm,
      troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds,
    });
  });

  it("follows the settings the app provides", () => {
    const provided = signal<PinyesRenderSettings>({
      shoulderHeightBaselineCm: 150,
      troncHeightThresholds: DEFAULT_COLLA_SETTINGS.troncHeightThresholds,
    });
    TestBed.configureTestingModule({ providers: [{ provide: PINYES_RENDER_SETTINGS, useValue: provided }] });
    const settings = TestBed.runInInjectionContext(() => injectPinyesRenderSettings());

    provided.update((s) => ({ ...s, shoulderHeightBaselineCm: 135 }));

    expect(settings().shoulderHeightBaselineCm).toBe(135);
  });
});
