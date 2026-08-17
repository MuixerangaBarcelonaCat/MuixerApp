import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { LucideAngularModule, Moon, Sun } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { PageHeaderComponent } from '../../shared/components/data/page-header/page-header.component';
import { ColorSectionComponent } from './sections/color-section.component';
import { TypographySectionComponent } from './sections/typography-section.component';
import { TokensSectionComponent } from './sections/tokens-section.component';
import { ComponentsSectionComponent } from './sections/components-section.component';

export type ColorThemeMode = 'light' | 'dark';

const LIGHT_THEME = 'colla-barcelona-light';
const DARK_THEME = 'colla-barcelona-dark';

@Component({
  selector: 'app-design-system',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    ButtonComponent,
    PageHeaderComponent,
    ColorSectionComponent,
    TypographySectionComponent,
    TokensSectionComponent,
    ComponentsSectionComponent,
  ],
  templateUrl: './design-system.component.html',
})
export class DesignSystemComponent {
  protected readonly SunIcon = Sun;
  protected readonly MoonIcon = Moon;

  private readonly documentTheme = document.documentElement.dataset;
  private readonly themeOnMount = this.documentTheme['theme'] ?? LIGHT_THEME;

  readonly mode = signal<ColorThemeMode>(this.themeOnMount === DARK_THEME ? 'dark' : 'light');

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.documentTheme['theme'] = this.themeOnMount;
    });
  }

  toggleMode(): void {
    const next: ColorThemeMode = this.mode() === 'light' ? 'dark' : 'light';
    this.mode.set(next);
    this.documentTheme['theme'] = next === 'light' ? LIGHT_THEME : DARK_THEME;
  }
}
