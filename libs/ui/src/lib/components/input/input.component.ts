import { ChangeDetectionStrategy, Component, ElementRef, booleanAttribute, computed, effect, forwardRef, input, output, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import type { LucideIconData } from 'lucide-angular';
import { Eye, EyeOff, LucideAngularModule } from 'lucide-angular';
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
  // A static `id="…"` on <lib-input> is bound to the `id` input *and* reflected onto the host
  // element. Stripping it here leaves a single element carrying the id — the native input — so an
  // external <label for="…"> focuses the field instead of the wrapper.
  host: { '[attr.id]': 'null' },
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
  // El gestor de contrasenyes del navegador identifica els camps per `autocomplete` i, com a
  // reserva (i en la majoria de gestors externs), pel `name`. L'`id` no serveix: és generat.
  name = input<string>();
  // Camp que es veu i s'envia amb el formulari, però no s'edita. Preferible a `disabled` quan
  // el valor és una dada real que el navegador ha de poder llegir (l'email prellenat de
  // l'activació): un camp `disabled` no s'envia i els gestors de contrasenyes l'ignoren.
  readonly = input(false, { transform: booleanAttribute });
  id = input<string>();
  // Native range constraints — meaningful only for type="number"/"date", passed straight through
  // rather than modeled (browsers already validate/constrain against them).
  min = input<string | number>();
  max = input<string | number>();
  maxLength = input<number>();
  // Imperative (via an effect + viewChild), not the native `autofocus` attribute: this field is
  // almost always toggled into existence by an `@if` (an inline rename row appearing), and the
  // native attribute's own "focus on insertion" behavior is inconsistent across browsers for that
  // case in a way a direct `.focus()` call isn't.
  autofocus = input(false, { transform: booleanAttribute });

  // A real @Output, not just internal CVA touched-tracking (registerOnTouched) — some callers
  // (the ad-hoc node label) run live-preview-then-commit-on-blur logic that needs to know the
  // blur actually happened, and (blur) placed directly on the host element wouldn't fire: the
  // native `blur` event does not bubble, so it never reaches the host from the inner `<input>`.
  readonly blurred = output<void>();

  private readonly nativeInputRef = viewChild<ElementRef<HTMLInputElement>>('nativeInputRef');

  protected readonly value = signal('');
  private readonly formDisabled = signal(false);
  private readonly generatedId = `lib-input-${++nextId}`;

  // Reveal toggle: offered automatically for every password field (no opt-in flag), because a
  // masked field the user can't read back is the same usability problem everywhere it appears.
  protected readonly EyeIcon = Eye;
  protected readonly EyeOffIcon = EyeOff;
  private readonly revealed = signal(false);

  protected readonly isPassword = computed(() => this.type() === 'password');
  // `revealed` is only honored while the field really is a password one, so a caller switching
  // the type away can't leave the input showing a stale `text`.
  protected readonly effectiveType = computed(() =>
    this.isPassword() && this.revealed() ? 'text' : this.type(),
  );
  // Sense res a escriure, el botó de l'ull no aporta res i deixaria mostrar en clar un valor
  // que l'usuari no controla.
  protected readonly isRevealed = computed(() => this.isPassword() && this.revealed());

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

  protected toggleReveal(): void {
    this.revealed.update((revealed) => !revealed);
  }

  protected onBlur(): void {
    this.onTouched();
    this.blurred.emit();
  }
}
