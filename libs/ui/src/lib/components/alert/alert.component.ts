import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  Info,
  LucideAngularModule,
  X,
  type LucideIconData,
} from 'lucide-angular';
import { ButtonComponent } from '../button/button.component';

export type AlertVariant = 'info' | 'success' | 'warning' | 'error';

const VARIANT_ICON: Record<AlertVariant, LucideIconData> = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  error: AlertCircle,
};

const VARIANT_CLASS: Record<AlertVariant, string> = {
  info: 'alert-info',
  success: 'alert-success',
  warning: 'alert-warning',
  error: 'alert-error',
};

// error/warning interrupt (a failed action, a risky state) — screen readers should announce them
// immediately; info/success are ambient and wait for a pause. `assertive` input overrides this
// for the rare case that doesn't follow the variant's usual urgency.
const VARIANT_ASSERTIVE: Record<AlertVariant, boolean> = {
  info: false,
  success: false,
  warning: true,
  error: true,
};

@Component({
  selector: 'lib-alert',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './alert.component.html',
  styleUrls: ['./alert.component.scss'],
})
export class AlertComponent {
  variant = input<AlertVariant>('info');
  // Compact inline strip (form-feedback under a field, a modal error line) vs. the default
  // standalone banner. Smaller type, tighter padding, no elevation.
  dense = input(false, { transform: booleanAttribute });
  // Optional bold lead line above the body content.
  title = input<string>();
  dismissible = input(false, { transform: booleanAttribute });
  // Override the per-variant icon (e.g. the install-prompt banner's platform-specific glyph).
  icon = input<LucideIconData>();
  // Force the assertive/polite politeness independent of the variant's default.
  assertive = input<boolean>();

  dismissed = output<void>();

  protected readonly X = X;

  protected readonly effectiveIcon = computed(() => this.icon() ?? VARIANT_ICON[this.variant()]);

  protected readonly isAssertive = computed(() => this.assertive() ?? VARIANT_ASSERTIVE[this.variant()]);

  protected readonly role = computed(() => (this.isAssertive() ? 'alert' : 'status'));

  protected readonly ariaLive = computed(() => (this.isAssertive() ? 'assertive' : 'polite'));

  protected readonly alertClass = computed(() =>
    [
      'alert',
      VARIANT_CLASS[this.variant()],
      this.dense() ? 'text-sm py-2' : 'shadow-raised',
    ].join(' '),
  );
}
