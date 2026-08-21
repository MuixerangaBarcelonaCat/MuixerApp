import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';
import type { InputSize } from '../input/input.component';

/**
 * Label/required-marker/hint/error chrome around a content-projected control — a raw `<select>`/
 * `<textarea>`, or a fully custom widget (a chip-toggle tag picker), not just `lib-input`. Pure
 * content projection, no control interface: the wrapper never sees the projected control's value
 * or validity, so `hint`/`errorText` are plain inputs the caller drives itself (same as `lib-input`
 * already does today from its own `form.get('x')?.invalid` checks).
 *
 * `id` exists only for the `for`/`aria-describedby` wiring — since the projected control is
 * opaque, the caller must also put that same id on their own control by hand (documented
 * trade-off: no Angular Material-style `MatFormFieldControl` registration contract here, on
 * purpose — this library stays "dumb" the same way Card/Button do).
 *
 * The `<label>` element wraps only the label *text*, not the whole field (unlike a typical
 * DaisyUI `form-control`): a `<label>` with no explicit target and more than one labelable
 * descendant (e.g. several `lib-badge clickable` chips) makes browsers forward a click anywhere
 * inside it to the *first* one, which read as that chip being permanently "stuck" mid-hover —
 * real bug hit by person-detail's Etiquetes picker. `for`/`id` still targets a specific control
 * by id for the single-control case (lib-input/lib-select).
 */
@Component({
  selector: 'lib-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './form-field.component.html',
  styleUrls: ['./form-field.component.scss'],
})
export class FormFieldComponent {
  label = input<string>();
  hint = input<string>();
  errorText = input<string>();
  required = input(false, { transform: booleanAttribute });
  size = input<InputSize>('sm');
  id = input<string>();

  protected readonly hasError = computed(() => !!this.errorText());
  protected readonly hasHint = computed(() => !this.hasError() && !!this.hint());
  protected readonly descriptionId = computed(() => (this.id() ? `${this.id()}-description` : undefined));

  protected readonly labelTextClass = computed(() =>
    ['label-text', 'font-medium', this.size() === 'xs' ? 'text-xs' : ''].filter(Boolean).join(' '),
  );
}
