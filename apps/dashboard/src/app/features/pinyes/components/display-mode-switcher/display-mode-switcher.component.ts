import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { ButtonComponent, ButtonGroupComponent } from '@muixer/ui';
import { DisplayMode } from '@muixer/pinyes-render';
import { CalendarCheck, LucideAngularModule, LucideIconData, Ruler, Shapes, VenusAndMars } from 'lucide-angular';

interface ModeOption {
  mode: DisplayMode;
  label: string;
  tooltip: string;
  icon: LucideIconData;
}

/** In this order: the shortcut keys 1–4 follow it. */
export const DISPLAY_MODE_OPTIONS: readonly ModeOption[] = [
  { mode: 'position', label: 'Posició', tooltip: 'Colors per posició (1)', icon: Shapes },
  { mode: 'height', label: 'Alçada', tooltip: 'Colors per alçada (2)', icon: Ruler },
  { mode: 'attendance', label: 'Assistència', tooltip: 'Colors per assistència (3)', icon: CalendarCheck },
  { mode: 'gender', label: 'Gènere', tooltip: 'Colors per gènere (4)', icon: VenusAndMars },
];

/** Keys 1–4 pick the switcher's modes in order; null for any other key, or with a modifier held. */
export function displayModeForKey(event: KeyboardEvent): DisplayMode | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const index = ['1', '2', '3', '4'].indexOf(event.key);
  return index >= 0 ? DISPLAY_MODE_OPTIONS[index].mode : null;
}

/**
 * The segment workspace's display-mode switch: what the node colors stand for. A segmented control
 * for the canvas toolbar; labels from `md` up, icons alone below (the tooltip and the accessible
 * name still say the mode). The host keeps the mode; this only asks for a new one.
 */
@Component({
  selector: 'app-display-mode-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, ButtonGroupComponent, LucideAngularModule],
  templateUrl: './display-mode-switcher.component.html',
})
export class DisplayModeSwitcherComponent {
  readonly mode = input.required<DisplayMode>();
  readonly modeChange = output<DisplayMode>();

  protected readonly options = DISPLAY_MODE_OPTIONS;
}
