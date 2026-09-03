import { ChangeDetectionStrategy, Component, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export type CheckboxSize = 'xs' | 'sm' | 'md' | 'lg';
export type CheckboxVariant = 'neutral' | 'primary' | 'secondary' | 'accent' | 'success' | 'warning' | 'info' | 'error';

// Static maps, not template-literal interpolation (`checkbox-${variant}`): Tailwind's content
// scanner needs each class name to appear literally somewhere for the DaisyUI plugin to keep it
// in the compiled CSS — a dynamically-built string isn't visible to it, so unused-elsewhere
// variants (secondary/accent/warning/info/error) silently rendered with no color at all until
// this was caught. Same convention `lib-button`/`lib-badge`/`lib-select` already use.
const SIZE_CLASSES: Record<CheckboxSize, string> = {
  xs: 'checkbox-xs',
  sm: 'checkbox-sm',
  md: 'checkbox-md',
  lg: 'checkbox-lg',
};

const VARIANT_CLASSES: Record<CheckboxVariant, string> = {
  neutral: '',
  primary: 'checkbox-primary',
  secondary: 'checkbox-secondary',
  accent: 'checkbox-accent',
  success: 'checkbox-success',
  warning: 'checkbox-warning',
  info: 'checkbox-info',
  error: 'checkbox-error',
};

let nextId = 0;

/**
 * A labeled checkbox — same `ControlValueAccessor`/label conventions as `lib-input`, but
 * content-projected for the label (like `lib-button`) rather than a `label` string input: real
 * usage ranges from a plain trailing word ("Sols actius") to a two-line title+hint block
 * (`news-editor`'s "Notifica els membres" send-push checkbox), and a plain string input can't
 * express the second shape.
 *
 * `variant="neutral"` (the DaisyUI-default unmodified `.checkbox`, no color class) reads as a
 * plain dark/gray outline, not a fabricated "neutral" color the way `lib-button`/`lib-badge`'s
 * `neutral` variant is an actual filled color — DaisyUI's `.checkbox` simply has no such modifier.
 */
@Component({
  selector: 'lib-checkbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkbox.component.html',
  styleUrls: ['./checkbox.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CheckboxComponent),
      multi: true,
    },
  ],
})
export class CheckboxComponent implements ControlValueAccessor {
  // For a label-less checkbox (no projected content) that still needs an accessible name.
  ariaLabel = input<string>();
  size = input<CheckboxSize>('sm');
  variant = input<CheckboxVariant>('primary');
  disabled = input(false, { transform: booleanAttribute });
  required = input(false, { transform: booleanAttribute });
  id = input<string>();

  protected readonly checked = signal(false);
  private readonly formDisabled = signal(false);
  private readonly generatedId = `lib-checkbox-${++nextId}`;

  protected readonly checkboxId = computed(() => this.id() ?? this.generatedId);
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly inputClasses = computed(() =>
    ['checkbox', SIZE_CLASSES[this.size()], VARIANT_CLASSES[this.variant()]].filter(Boolean).join(' '),
  );

  private onChange: (value: boolean) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  writeValue(value: boolean | null): void {
    this.checked.set(!!value);
  }

  registerOnChange(fn: (value: boolean) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  protected onInputChange(event: Event): void {
    const value = (event.target as HTMLInputElement).checked;
    this.checked.set(value);
    this.onChange(value);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
