import { Directive, computed, input } from '@angular/core';
import type { ThemeMode } from '../tokens/color';
import { THEME_NAMES } from '../tokens/theme-names';

/**
 * Pins an element (and everything inside it) to one mode regardless of the page theme — e.g. a
 * projection HUD that is always dark. Every theme token resolves from the pinned theme inside.
 * Note: DaisyUI paints `background-color: base-100` and `color: base-content` on every
 * `[data-theme]` element, so give a translucent element an explicit `bg-*` class (utilities win
 * over that base-layer rule).
 */
@Directive({
  selector: '[libThemeScope]',
  host: { '[attr.data-theme]': 'themeName()' },
})
export class ThemeScopeDirective {
  readonly libThemeScope = input.required<ThemeMode>();
  protected readonly themeName = computed(() => THEME_NAMES[this.libThemeScope()]);
}
