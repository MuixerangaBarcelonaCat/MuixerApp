import { TestBed } from '@angular/core/testing';
import { ThemeService } from '@muixer/ui';
import { buildCanvasTheme } from './canvas-theme';
import { injectCanvasTheme } from './inject-canvas-theme';

describe('injectCanvasTheme', () => {
  afterEach(() => {
    TestBed.inject(ThemeService).setPreference('system');
    localStorage.clear();
  });

  const inject = () => TestBed.runInInjectionContext(() => injectCanvasTheme());

  it('follows the theme on screen', () => {
    TestBed.inject(ThemeService).setPreference('light');
    expect(inject()()).toEqual(buildCanvasTheme('light'));
  });

  it('switches to the dark canvas when the app turns dark', () => {
    const theme = inject();
    TestBed.inject(ThemeService).setPreference('light');
    expect(theme().mode).toBe('light');
    TestBed.inject(ThemeService).setPreference('dark');
    expect(theme()).toEqual(buildCanvasTheme('dark'));
  });
});
