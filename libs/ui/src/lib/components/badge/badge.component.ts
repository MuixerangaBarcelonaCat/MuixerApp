import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { contrastContent, formatOklch, hexToOklch } from '../../tokens/color';
import { INK, PAPER } from '../../tokens/fixed-colors';

export type BadgeVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'ghost'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  secondary: 'badge-secondary',
  accent: 'badge-accent',
  neutral: 'badge-neutral',
  ghost: 'badge-ghost',
  info: 'badge-info',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  xs: 'badge-xs',
  sm: 'badge-sm',
  md: '',
  lg: 'badge-lg',
};

const INK_BLACK = hexToOklch(INK.black);
const PAPER_WHITE = hexToOklch(PAPER.white);

@Component({
  selector: 'lib-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './badge.component.html',
  styleUrls: ['./badge.component.scss'],
})
export class BadgeComponent {
  variant = input<BadgeVariant>('neutral');
  size = input<BadgeSize>('md');
  outline = input(false, { transform: booleanAttribute });
  // For domain-assigned colors (tags, figure-node presets) — a person/tag's own color, not one
  // of the fixed variant roles. Takes precedence over `variant` when set.
  color = input<string>();

  protected readonly badgeClass = computed(() =>
    [
      'badge',
      this.color() ? '' : VARIANT_CLASSES[this.variant()],
      SIZE_CLASSES[this.size()],
      this.outline() ? 'badge-outline' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly customContentColor = computed(() => {
    const color = this.color();
    if (!color) {
      return null;
    }
    return formatOklch(contrastContent(hexToOklch(color), INK_BLACK, PAPER_WHITE));
  });
}
