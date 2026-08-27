import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  ElementRef,
  DestroyRef,
  afterNextRender,
  booleanAttribute,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LucideAngularModule, ChevronDown } from 'lucide-angular';
import { FormFieldComponent } from '../form-field/form-field.component';
import type { InputSize } from '../input/input.component';

const SIZE_CLASSES: Record<InputSize, string> = {
  xs: 'select-xs',
  sm: 'select-sm',
  md: '',
  lg: 'select-lg',
};

let nextId = 0;

interface SelectOptionData {
  value: string;
  disabled: boolean;
  content: Node[];
}

/**
 * Clones an <option>'s already-rendered child nodes into the checkbox row's own DOM, so
 * `multiple` mode renders the exact same rich markup (icon/color-swatch children, not just text)
 * as the native <select> does in single mode — same projected <option>, same visual content,
 * no separate "rich content" API. Uses cloneNode, never innerHTML: the nodes are already-parsed,
 * already-rendered DOM (Angular resolved any bindings on them upstream, in the caller's own
 * template) — relocating them carries no injection risk, unlike re-parsing a string.
 */
@Directive({ selector: '[libSelectOptionContent]' })
export class SelectOptionContentDirective {
  private readonly el = inject(ElementRef<HTMLElement>);
  readonly content = input.required<Node[]>({ alias: 'libSelectOptionContent' });

  constructor() {
    effect(() => {
      this.el.nativeElement.replaceChildren(...this.content().map((node) => node.cloneNode(true)));
    });
  }
}

/**
 * The select-flavored analogue of lib-input — same ControlValueAccessor/label/hint/error
 * conventions (via lib-form-field), just wrapping a native `<select>` instead of `<input>`.
 * Options are content-projected (`<option>`/`<optgroup>`), not modeled as a data input — the
 * caller's own list often needs conditional rendering (`@for`) that a plain array input can't
 * express as cleanly.
 *
 * Two modes, same projected <option> markup:
 * - default (single): a native <select>, styled via `appearance: base-select` so its dropdown
 *   panel (not just the closed control) picks up our theme — browsers without the feature just
 *   render the ordinary native picker, no fallback code needed. `<option>`s may contain child
 *   markup (an icon, a color swatch) — the new spec relaxes <option>'s content model to allow it.
 * - `multiple`: a custom checkbox-list dropdown (native `<select multiple>`'s UX — a scrolling
 *   listbox requiring ctrl/cmd-click — is bad regardless of base-select support, so this never
 *   uses it). The native <select> stays in the DOM (hidden) purely as the canonical projected-
 *   <option> source: a MutationObserver re-scans it into the `options` signal whenever the
 *   caller's own template changes what it projects, and each checkbox row clones that option's
 *   child nodes via `SelectOptionContentDirective` — so rich content matches single mode exactly.
 */
@Component({
  selector: 'lib-select',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormFieldComponent, LucideAngularModule, SelectOptionContentDirective],
  templateUrl: './select.component.html',
  styleUrls: ['./select.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => SelectComponent),
      multi: true,
    },
  ],
})
export class SelectComponent implements ControlValueAccessor {
  label = input<string>();
  // For a compact, label-less select (no visible `label`) that still needs an accessible name —
  // `label` renders visible text via lib-form-field, which isn't always the right call inline.
  ariaLabel = input<string>();
  hint = input<string>();
  errorText = input<string>();
  size = input<InputSize>('sm');
  disabled = input(false, { transform: booleanAttribute });
  required = input(false, { transform: booleanAttribute });
  id = input<string>();
  multiple = input(false, { transform: booleanAttribute });
  placeholder = input('Totes');

  protected readonly ChevronDownIcon = ChevronDown;

  protected readonly singleValue = signal('');
  protected readonly multiValue = signal<string[]>([]);
  protected readonly options = signal<SelectOptionData[]>([]);

  private readonly formDisabled = signal(false);
  private readonly generatedId = `lib-select-${++nextId}`;

  protected readonly selectId = computed(() => this.id() ?? this.generatedId);
  protected readonly descriptionId = computed(() => `${this.selectId()}-description`);
  protected readonly hasError = computed(() => !!this.errorText());
  protected readonly hasHint = computed(() => !this.hasError() && !!this.hint());
  protected readonly hasDescription = computed(() => this.hasError() || this.hasHint());
  protected readonly isDisabled = computed(() => this.disabled() || this.formDisabled());

  protected readonly boxClasses = computed(() =>
    [
      'select',
      'select-bordered',
      'lib-select-native',
      'bg-base-100',
      SIZE_CLASSES[this.size()],
      this.hasError() ? 'select-error' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  // The multiple-mode trigger reuses the exact same field chrome as the native <select> above
  // (not lib-button's variant/outline system, and deliberately no `ds-lift` — a form-field trigger
  // reads as "part of the field," not as a discrete action button, so it shouldn't share buttons'
  // hover-lift/press-bounce language) — plus `w-full`/layout classes a <select> doesn't need since
  // its own intrinsic content sizing differs from a <button>'s.
  protected readonly triggerClasses = computed(() => `${this.boxClasses()} w-full justify-between gap-2`);

  protected readonly triggerLabel = computed(() => {
    const count = this.multiValue().length;
    return count === 0 ? this.placeholder() : `${count} seleccionades`;
  });

  private readonly selectRef = viewChild.required<ElementRef<HTMLSelectElement>>('selectRef');
  private readonly destroyRef = inject(DestroyRef);

  private onChange: (value: string | string[]) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    // A template [value] binding races the content-projected <option>s (the <select>'s own
    // property bindings apply before projected children are inserted), so an effect() — which
    // runs after the view has settled — is used instead.
    //
    // Reading `options()` is what makes this correct rather than merely well-timed: assigning a
    // value the <select> has no matching <option> for silently resets it to '', and the options
    // can arrive later than any single run of this effect — on first render with a reactive
    // control (which writes its value synchronously, before the caller's view has projected
    // anything) or whenever the caller's own @for produces a different list. `options` is fed by
    // the MutationObserver below, so every such change re-applies the value.
    effect(() => {
      if (this.multiple()) return;
      this.options();
      this.selectRef().nativeElement.value = this.singleValue();
    });

    afterNextRender(() => {
      const host = this.selectRef().nativeElement;
      this.scanOptions();

      const observer = new MutationObserver(() => this.scanOptions());
      observer.observe(host, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['value', 'disabled'],
      });
      this.destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  private scanOptions(): void {
    const host = this.selectRef().nativeElement;
    this.options.set(
      Array.from(host.querySelectorAll('option')).map((el) => ({
        value: el.value,
        disabled: el.disabled,
        content: Array.from(el.childNodes),
      })),
    );
  }

  protected isSelected(value: string): boolean {
    return this.multiValue().includes(value);
  }

  protected toggleValue(value: string): void {
    const next = this.isSelected(value) ? this.multiValue().filter((v) => v !== value) : [...this.multiValue(), value];
    this.multiValue.set(next);
    this.onChange(next);
  }

  writeValue(value: string | string[] | null): void {
    if (this.multiple()) {
      this.multiValue.set(Array.isArray(value) ? value : []);
    } else {
      this.singleValue.set(typeof value === 'string' ? value : '');
    }
  }

  registerOnChange(fn: (value: string | string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.formDisabled.set(isDisabled);
  }

  protected onChangeEvent(event: Event): void {
    const newValue = (event.target as HTMLSelectElement).value;
    this.singleValue.set(newValue);
    this.onChange(newValue);
  }

  protected onBlur(): void {
    this.onTouched();
  }
}
