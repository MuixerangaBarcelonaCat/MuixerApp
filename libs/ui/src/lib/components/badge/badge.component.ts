import { booleanAttribute, ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { LiftHoverDirective } from '../../directives/lift-hover.directive';
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
  imports: [NgTemplateOutlet, LiftHoverDirective],
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
  // Toggle-chip mode (e.g. a multi-select tag picker): renders a real <button> instead of a
  // <span> so it's a genuine interactive control, not a styled label with a click handler bolted
  // on. `selected` only has meaning here — a static label has no toggle state to show.
  clickable = input(false, { transform: booleanAttribute });
  selected = input(false, { transform: booleanAttribute });
  // Opt-in: outlined + [color] normally sets the outline's text to the tag's own hex (matching
  // the border), which reads poorly for light/pale colors on the page background. When set, text
  // falls back to the ambient theme text color instead — border still stays in the tag's color.
  // Off by default: no existing outlined+colored usage needed it, and some (e.g. an "own color,
  // full identity" chip) may deliberately want the tag color carried through to the text too.
  readableOutlineText = input(false, { transform: booleanAttribute });
  // For clickable chips whose content alone isn't a sufficient accessible name (an emoji, an
  // icon-only chip) — same convention as lib-button's own `ariaLabel`.
  ariaLabel = input<string>();

  clicked = output<void>();

  // Toggle-chip selection reuses the plain `outline` treatment rather than a separate dimmed/ring
  // look: filled = selected, outline-only = unselected. Also outlined whenever the caller sets
  // `outline` directly (the static, non-toggle case).
  protected readonly isOutlined = computed(() => this.outline() || (this.clickable() && !this.selected()));

  protected readonly badgeClass = computed(() =>
    [
      'badge',
      this.color() ? '' : VARIANT_CLASSES[this.variant()],
      SIZE_CLASSES[this.size()],
      this.isOutlined() ? 'badge-outline' : '',
      // No forced min-h-6 tap-target floor here: it used to clamp every clickable badge to a
      // taller height regardless of `size`, so a clickable badge never actually matched a static
      // one at the same size (the whole point of `size` existing) — the chips' own gap-1.5
      // spacing is relied on instead to keep mis-taps unlikely at the smaller sizes.
      // `ds-lift` is the shared hover-lift/press-bounce motion (libs/ui/src/styles/_interactive.scss)
      // — `ds-lift-no-shadow` opts out of its own box-shadow: on a tightly-packed chip row (Etiquetes'
      // gap-1.5) that shadow's blur radius bleeds past a hovered chip's edge into its neighbors, so
      // `hover:shadow-raised` (Tailwind, tighter blur) is used instead.
      this.clickable() ? 'cursor-pointer ds-lift ds-lift-no-shadow hover:shadow-raised' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  // null (unset) falls back to the ambient theme text color via normal CSS cascade — deliberately
  // not computed against `color()` at all, since that hex is the *border*'s color here, not a
  // background text needs to contrast against.
  protected readonly outlineTextColor = computed(() => (this.readableOutlineText() ? null : (this.color() ?? null)));

  protected readonly customContentColor = computed(() => {
    const color = this.color();
    if (!color) {
      return null;
    }
    return formatOklch(contrastContent(hexToOklch(color), INK_BLACK, PAPER_WHITE));
  });
}
