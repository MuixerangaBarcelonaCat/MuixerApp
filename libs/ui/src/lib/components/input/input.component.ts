import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, forwardRef, input, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { LucideIconData } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';
import { FormFieldComponent } from '../form-field/form-field.component';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg';
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search' | 'date';

const SIZE_CLASSES: Record<InputSize, string> = {
  xs: 'input-xs',
  sm: 'input-sm',
  md: '',
  lg: 'input-lg',
};

let nextId = 0;

@Component({
  selector: 'lib-input',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, FormFieldComponent],
  templateUrl: './input.component.html',
  styleUrls: ['./input.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true,
    },
  ],
})
export class InputComponent implements ControlValueAccessor {
  label = input<string>();
  // For a compact, label-less input (no visible `label`) that still needs an accessible name —
  // `label` renders visible text via lib-form-field, which isn't always the right call inline.
  ariaLabel = input<string>();
  hint = input<string>();
  errorText = input<string>();
  icon = input<LucideIconData>();
  size = input<InputSize>('sm');
  type = input<InputType>('text');
  placeholder = input<string>();
  disabled = input(false, { transform: booleanAttribute });
  required = input(false, { transform: booleanAttribute });
  autocomplete = input<string>();
  id = input<string>();
  // Native range constraints — meaningful only for type="number"/"date", passed straight through
  // rather than modeled (browsers already validate/constrain against them).
  min = input<string | number>();
  max = input<string | number>();
  // Imperative (via an effect + viewChild), not the native `autofocus` attribute: this field is
  // almost always toggled into existence by an `@if` (an inline rename row appearing), and the
  // native attribute's own "focus on insertion" behavior is inconsistent across browsers for that
  // case in a way a direct `.focus()` call isn't.
  autofocus = input(false, { transform: booleanAttribute });

  private readonly nativeInputRef = viewChild<ElementRef<HTMLInputElement>>('nativeInputRef');

  protected readonly value = signal('');
  private readonly formDisabled = signal(false);
  private readonly generatedId = `lib-input-${++nextId}`;

  protected readonly inputId = computed(() => this.id() ?? this.generatedId);
  protected readonly descriptionId = computed(() => `${this.inputId()}-description`);
  protected readonly hasError = computed(() => !!this.errorText());
  protected readonly hasHint = computed(() => !this.hasError() && !!this.hint());
  protected readonly hasDescription = computed(() => this.hasError() || this.hasHint());
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly boxClasses = computed(() =>
    [
      'input',
      'input-bordered',
      'flex',
      'items-center',
      'gap-2',
      'bg-base-100',
      SIZE_CLASSES[this.size()],
      this.hasError() ? 'input-error' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    effect(() => {
      if (!this.autofocus()) return;
      this.nativeInputRef()?.nativeElement.focus();
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
    const newValue = (event.target as HTMLInputElement).value;
    this.value.set(newValue);
    this.onChange(newValue);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
