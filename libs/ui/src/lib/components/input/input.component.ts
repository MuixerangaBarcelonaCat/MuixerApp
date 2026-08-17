import { ChangeDetectionStrategy, Component, booleanAttribute, computed, forwardRef, input, signal } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { LucideIconData } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg';
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url' | 'search';

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
  imports: [LucideAngularModule],
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
    ['input', 'input-bordered', 'flex', 'items-center', 'gap-2', SIZE_CLASSES[this.size()], this.hasError() ? 'input-error' : '']
      .filter(Boolean)
      .join(' '),
  );

  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

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
