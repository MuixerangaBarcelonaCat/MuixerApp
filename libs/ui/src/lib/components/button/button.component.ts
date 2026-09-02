import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  HostAttributeToken,
  inject,
  input,
  isDevMode,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { LiftHoverDirective } from '../../directives/lift-hover.directive';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'neutral'
  | 'ghost'
  | 'info'
  | 'success'
  | 'warning'
  | 'error';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';
export type ButtonShape = 'default' | 'square' | 'circle';
export type ButtonType = 'button' | 'submit' | 'reset';

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  accent: 'btn-accent',
  neutral: 'btn-neutral',
  ghost: 'btn-ghost',
  info: 'btn-info',
  success: 'btn-success',
  warning: 'btn-warning',
  error: 'btn-error',
};

// `ghost` modifier: renders `btn-ghost` (no fill, no border) but keeps the chosen `variant`'s
// role color as the text/icon color — a lighter-weight alternative to `outline` for a coloured
// action that shouldn't carry a box (e.g. a destructive icon button in a dense card row). Static
// literals so Tailwind's content scanner keeps them (same rule as VARIANT_CLASSES). `ghost`
// variant itself contributes nothing extra — it's already colourless.
const GHOST_TEXT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'text-primary',
  secondary: 'text-secondary',
  accent: 'text-accent',
  neutral: 'text-neutral',
  ghost: '',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'btn-xs',
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

const SHAPE_CLASSES: Record<ButtonShape, string> = {
  default: '',
  square: 'btn-square',
  circle: 'btn-circle',
};

const LOADING_SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'loading-xs',
  sm: 'loading-sm',
  md: 'loading-md',
  lg: 'loading-lg',
};

@Component({
  selector: 'lib-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, NgTemplateOutlet, LiftHoverDirective],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  shape = input<ButtonShape>('default');
  type = input<ButtonType>('button');
  ariaLabel = input<string>();
  // Toggle-state ARIA, for buttons whose whole job is flipping a boolean (a visibility switch,
  // a collapse/expand disclosure) — distinct from `active`, which is `lib-button-group`'s purely
  // visual "which joinItem segment is selected" marker, not a real toggle-button semantic.
  ariaExpanded = input<boolean>();
  ariaPressed = input<boolean>();
  // For a disclosure toggle (e.g. "Mostra"/"Amaga") pointing at the region it expands — same
  // convention as ariaExpanded/ariaPressed, just an id reference instead of a boolean.
  ariaControls = input<string>();
  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  outline = input(false, { transform: booleanAttribute });
  // See GHOST_TEXT_CLASSES above. Renders `btn-ghost` (no fill/border) while keeping `variant`'s
  // role colour as the text/icon colour. Takes precedence over `outline` when both are set.
  ghost = input(false, { transform: booleanAttribute });
  fullWidth = input(false, { transform: booleanAttribute });
  // For lib-button-group: adds DaisyUI's own `.join-item` to this button's real rendered element.
  // lib-button-group can't add that class itself — its own children are opaque `display:contents`
  // hosts, so there's nothing of its own for `.join`'s CSS to select; each button has to carry the
  // marker on its own rendered tag instead, same reasoning as lib-form-field's `id` duplication.
  joinItem = input(false, { transform: booleanAttribute });
  // Marks the currently-selected segment in a lib-button-group. Deliberately NOT DaisyUI's own
  // `.btn-active` (a darkened fill) — nowhere else in the app marks "selected" by darkening a
  // color. Only takes effect on a joinItem button — a plain button has no "unselected" state to
  // contrast against. Two selection languages (see `outlineMode`):
  //   fill mode (default):    selected = filled,  unselected = outline
  //   outline mode:           selected = outline,  unselected = ghost (no fill, no border)
  active = input(false, { transform: booleanAttribute });
  // Swaps a joinItem segment's fill/outline/ghost mapping (see `active` above) from the default
  // "fill mode" to "outline mode" — for contexts too visually heavy for a fully filled selected
  // segment. Independent of `variant`: any color works in either mode, except `variant="ghost"`
  // itself, which the constructor rejects outright below — ghost has no fill and no border, so a
  // ghost segmented control would have no way to show which segment is selected at all.
  outlineMode = input(false, { transform: booleanAttribute });
  // Link mode, mirroring lib-card's exact same priority: routerLink wins over href. Neither
  // combines with disabled/loading — see the constructor invariant below.
  routerLink = input<string | unknown[]>();
  href = input<string>();
  // Imperative (an effect + viewChild), not the native `autofocus` attribute — same rationale as
  // lib-input/lib-textarea's own autofocus: a button using this is almost always the default
  // action of a dialog that just opened via an `@if`/`lib-modal[open]` toggle, and the native
  // attribute's "focus on insertion" behavior is inconsistent for that case in a way a direct
  // `.focus()` call isn't. (A `<dialog>.showModal()` does honor a *native* `autofocus` attribute
  // on its own — but only when it sits on the actual focusable element, which `display: contents`
  // hosts can't forward from `<lib-button autofocus>` down to the real inner `<button>`.)
  autofocus = input(false, { transform: booleanAttribute });
  // Native-tooltip text for the rendered control. Needed because `:host { display: contents }`
  // gives the `<lib-button>` element no box, so a `title` attribute placed on it by a consumer
  // never produces a hover tooltip and is never forwarded to the inner `<button>`/`<a>`. Set
  // `[tooltip]` for a dynamic value; a static `title="…"` attribute on the host is also picked up
  // (see `hostTitle` below) so existing call sites keep working. When nothing here is set, an
  // `ariaLabel` (near-always an icon-only button's accessible name) is mirrored into `title` so it
  // also shows as a hover tooltip — pass `tooltip=""` on a button to opt out.
  tooltip = input<string>();

  clicked = output<void>();

  // Static `title="…"` written directly on the `<lib-button>` host — read once at construction
  // (dynamic `[title]` bindings won't land here; those callers should use `[tooltip]`).
  private readonly hostTitle = inject(new HostAttributeToken('title'), { optional: true });

  protected readonly resolvedTitle = computed(() => {
    const explicit = this.tooltip();
    if (explicit !== undefined) return explicit || null; // `tooltip=""` opts out of the mirror
    return this.hostTitle || this.ariaLabel() || null;
  });

  private readonly nativeButtonRef = viewChild<ElementRef<HTMLElement>>('nativeButtonRef');

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());

  // Ghost-in-outline-mode is the only joinItem cell with no visible fill AND no visible border —
  // treated the same as fill-mode's unselected segment (both render as plain ghost).
  protected readonly isGhostSegment = computed(
    () => this.joinItem() && this.outlineMode() && !this.active(),
  );

  // `ghost` and `outline` are mutually exclusive — ghost wins (see the input's doc).
  protected readonly isGhost = computed(() => this.ghost() && !this.joinItem());

  protected readonly isOutlined = computed(() => {
    if (this.isGhost()) return false;
    if (!this.joinItem()) return this.outline();
    return this.outlineMode() ? this.active() : !this.active();
  });

  protected readonly resolvedVariantClass = computed(() =>
    this.isGhostSegment() || this.isGhost() ? VARIANT_CLASSES.ghost : VARIANT_CLASSES[this.variant()],
  );

  protected readonly buttonClass = computed(() =>
    [
      'btn',
      'ds-lift',
      this.resolvedVariantClass(),
      this.isGhost() ? GHOST_TEXT_CLASSES[this.variant()] : '',
      SIZE_CLASSES[this.size()],
      SHAPE_CLASSES[this.shape()],
      this.isOutlined() ? 'btn-outline' : '',
      this.fullWidth() ? 'w-full' : '',
      this.loading() ? 'lib-btn-loading' : '',
      this.joinItem() ? 'join-item' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly loadingClass = computed(() => `loading loading-spinner ${LOADING_SIZE_CLASSES[this.size()]}`);

  constructor() {
    if (isDevMode()) {
      effect(() => {
        if (this.shape() !== 'default' && !this.ariaLabel()) {
          console.warn(
            '[lib-button] icon-only buttons (shape="square"/"circle") must set ariaLabel for screen-reader accessibility.',
          );
        }
      });
    }

    effect(() => {
      const isLink = !!(this.routerLink() || this.href());
      if (isLink && this.disabled()) {
        throw new Error('lib-button: disabled cannot be combined with routerLink/href — a disabled link is not a supported shape.');
      }
      if (isLink && this.loading()) {
        throw new Error('lib-button: loading cannot be combined with routerLink/href — a loading link is not a supported shape.');
      }
    });

    effect(() => {
      if (this.joinItem() && this.variant() === 'ghost') {
        throw new Error(
          'lib-button: variant="ghost" cannot be used with joinItem — ghost has no fill or border, so a segmented control could never show which segment is selected.',
        );
      }
    });

    effect(() => {
      if (!this.autofocus()) return;
      this.nativeButtonRef()?.nativeElement.focus();
    });
  }
}
