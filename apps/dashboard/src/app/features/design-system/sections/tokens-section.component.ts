import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RADIUS, SHADOW, DURATION, EASE, EASE_SPRING, Z_INDEX } from '@muixer/ui';

interface NamedValue {
  name: string;
  value: string;
}

const RADIUS_SAMPLES: NamedValue[] = [
  { name: 'RADIUS.box', value: RADIUS.box },
  { name: 'RADIUS.btn', value: RADIUS.btn },
  { name: 'RADIUS.badge', value: RADIUS.badge },
  { name: 'RADIUS.tab', value: RADIUS.tab },
];

const SHADOW_SAMPLES: NamedValue[] = [
  { name: 'SHADOW.flat', value: SHADOW.flat },
  { name: 'SHADOW.raised', value: SHADOW.raised },
  { name: 'SHADOW.overlay', value: SHADOW.overlay },
  { name: 'SHADOW.modal', value: SHADOW.modal },
];

const MOTION_SAMPLES: NamedValue[] = [
  { name: 'DURATION.fast', value: DURATION.fast },
  { name: 'DURATION.base', value: DURATION.base },
  { name: 'DURATION.slow', value: DURATION.slow },
  { name: 'EASE', value: EASE },
  { name: 'EASE_SPRING', value: EASE_SPRING },
];

const Z_SAMPLES: NamedValue[] = [
  { name: 'Z_INDEX.raised', value: String(Z_INDEX.raised) },
  { name: 'Z_INDEX.dropdown', value: String(Z_INDEX.dropdown) },
  { name: 'Z_INDEX.chrome', value: String(Z_INDEX.chrome) },
  { name: 'Z_INDEX.modal', value: String(Z_INDEX.modal) },
  { name: 'Z_INDEX.system', value: String(Z_INDEX.system) },
];

@Component({
  selector: 'app-tokens-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './tokens-section.component.html',
})
export class TokensSectionComponent {
  protected readonly radiusSamples = RADIUS_SAMPLES;
  protected readonly shadowSamples = SHADOW_SAMPLES;
  protected readonly motionSamples = MOTION_SAMPLES;
  protected readonly zSamples = Z_SAMPLES;
}
