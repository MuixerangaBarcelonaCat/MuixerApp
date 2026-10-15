import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ThemePickerComponent, ThemeService } from '@muixer/ui';
import { PageHeaderComponent } from '../../shared/components/data/page-header/page-header.component';
import { ColorSectionComponent } from './sections/color-section.component';
import { TypographySectionComponent } from './sections/typography-section.component';
import { TokensSectionComponent } from './sections/tokens-section.component';
import { ComponentsSectionComponent } from './sections/components-section.component';

@Component({
  selector: 'app-design-system',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ThemePickerComponent,
    PageHeaderComponent,
    ColorSectionComponent,
    TypographySectionComponent,
    TokensSectionComponent,
    ComponentsSectionComponent,
  ],
  templateUrl: './design-system.component.html',
})
export class DesignSystemComponent {
  protected readonly theme = inject(ThemeService);
}
