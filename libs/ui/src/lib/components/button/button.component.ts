import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  isDevMode,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

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
  imports: [RouterLink, NgTemplateOutlet],
  templateUrl: './button.component.html',
  styleUrls: ['./button.component.scss'],
})
export class ButtonComponent {
  variant = input<ButtonVariant>('primary');
  size = input<ButtonSize>('md');
  shape = input<ButtonShape>('default');
  type = input<ButtonType>('button');
  ariaLabel = input<string>();
  disabled = input(false, { transform: booleanAttribute });
  loading = input(false, { transform: booleanAttribute });
  outline = input(false, { transform: booleanAttribute });
  // Link mode, mirroring lib-card's exact same priority: routerLink wins over href. Neither
  // combines with disabled/loading — see the constructor invariant below.
  routerLink = input<string | unknown[]>();
  href = input<string>();

  clicked = output<void>();

  protected readonly isDisabled = computed(() => this.disabled() || this.loading());

  protected readonly buttonClass = computed(() =>
    [
      'btn',
      VARIANT_CLASSES[this.variant()],
      SIZE_CLASSES[this.size()],
      SHAPE_CLASSES[this.shape()],
      this.outline() ? 'btn-outline' : '',
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
  }
}
