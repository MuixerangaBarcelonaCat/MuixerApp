import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule, Monitor, Moon, Sun, type LucideIconData } from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';
import { ButtonGroupComponent } from '../button-group/button-group.component';
import { ThemePreference, ThemeService } from '../../services/theme.service';

interface ThemeOption {
  value: ThemePreference;
  label: string;
  icon: LucideIconData;
}

/** «Sistema / Clar / Fosc» icon-only segmented control for the per-device theme preference. */
@Component({
  selector: 'lib-theme-picker',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent, ButtonGroupComponent],
  template: `
    <div role="group" aria-label="Aparença">
      <lib-button-group>
        @for (option of options; track option.value) {
          <lib-button
            joinItem
            size="xs"
            shape="square"
            variant="primary"
            [ariaLabel]="option.label"
            [tooltip]="option.label"
            [active]="theme.preference() === option.value"
            [ariaPressed]="theme.preference() === option.value"
            (clicked)="theme.setPreference(option.value)"
          >
            <lucide-icon [img]="option.icon" [size]="14" aria-hidden="true" />
          </lib-button>
        }
      </lib-button-group>
    </div>
  `,
})
export class ThemePickerComponent {
  protected readonly theme = inject(ThemeService);

  protected readonly options: readonly ThemeOption[] = [
    { value: 'system', label: 'Sistema', icon: Monitor },
    { value: 'light', label: 'Clar', icon: Sun },
    { value: 'dark', label: 'Fosc', icon: Moon },
  ];
}
