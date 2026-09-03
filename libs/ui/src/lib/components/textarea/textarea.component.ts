import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, forwardRef, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FormFieldComponent } from '../form-field/form-field.component';
import type { InputSize } from '../input/input.component';

const SIZE_CLASSES: Record<InputSize, string> = {
  xs: 'textarea-xs',
  sm: 'textarea-sm',
  md: '',
  lg: 'textarea-lg',
};

let nextId = 0;

@Component({
  selector: 'lib-textarea',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent],
  templateUrl: './textarea.component.html',
  styleUrls: ['./textarea.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextareaComponent),
      multi: true,
    },
  ],
})
export class TextareaComponent implements ControlValueAccessor {
  label = input<string>();
  // For a compact, label-less textarea (no visible `label`) that still needs an accessible name —
  // same rationale as lib-input's ariaLabel.
  ariaLabel = input<string>();
  hint = input<string>();
  errorText = input<string>();
  size = input<InputSize>('sm');
  placeholder = input<string>();
  rows = input(3);
  // Most real usages want the default browser resize handle; the two comodín/ad-hoc-label
  // textareas — small, fixed-purpose fields inside a modal — turn it off to keep layout stable.
  resize = input(true, { transform: booleanAttribute });
  disabled = input(false, { transform: booleanAttribute });
  required = input(false, { transform: booleanAttribute });
  maxLength = input<number>();
  id = input<string>();
  // Imperative (an effect + viewChild), not the native `autofocus` attribute — same rationale as
  // lib-input's own autofocus: this field is almost always toggled into existence by an `@if`
  // (a dialog opening), and the native attribute's "focus on insertion" behavior is inconsistent
  // across browsers for that case in a way a direct `.focus()` call isn't.
  autofocus = input(false, { transform: booleanAttribute });

  // A real @Output, not just internal CVA touched-tracking (registerOnTouched) — some callers
  // (the ad-hoc node label) run live-preview-then-commit-on-blur logic that needs to know the
  // blur actually happened, and (blur) placed directly on the host element wouldn't fire: the
  // native `blur` event does not bubble, so it never reaches the host from the inner `<textarea>`.
  readonly blurred = output<void>();

  private readonly nativeTextareaRef = viewChild<ElementRef<HTMLTextAreaElement>>('nativeTextareaRef');

  protected readonly value = signal('');
  private readonly formDisabled = signal(false);
  private readonly generatedId = `lib-textarea-${++nextId}`;

  protected readonly textareaId = computed(() => this.id() ?? this.generatedId);
  protected readonly descriptionId = computed(() => `${this.textareaId()}-description`);
  protected readonly hasError = computed(() => !!this.errorText());
  protected readonly hasHint = computed(() => !this.hasError() && !!this.hint());
  protected readonly hasDescription = computed(() => this.hasError() || this.hasHint());
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly textareaClasses = computed(() =>
    [
      'textarea',
      'textarea-bordered',
      'w-full',
      'bg-base-100',
      SIZE_CLASSES[this.size()],
      this.resize() ? '' : 'resize-none',
      this.hasError() ? 'textarea-error' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      if (!this.autofocus()) return;
      this.nativeTextareaRef()?.nativeElement.focus();
    });
  }

  writeValue(value: string | null): void {
    this.value.set(value ?? '');
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  protected onInput(event: Event): void {
    const newValue = (event.target as HTMLTextAreaElement).value;
    this.value.set(newValue);
    this.onChange(newValue);
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }
}
