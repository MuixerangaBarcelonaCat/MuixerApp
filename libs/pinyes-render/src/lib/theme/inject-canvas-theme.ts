import { Signal, computed, inject } from '@angular/core';
import { ThemeService } from '@muixer/ui';
import { CanvasTheme, buildCanvasTheme } from './canvas-theme';

/** The canvas theme for the mode on screen, changing with it. Call it in an injection context. */
export function injectCanvasTheme(): Signal<CanvasTheme> {
  const mode = inject(ThemeService).mode;
  return computed(() => buildCanvasTheme(mode()));
}
