import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block' },
  template: `
    <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
    <label class="form-control w-full">
      <div class="label pb-1">
        <span class="label-text font-medium">
          {{ label() }}
          @if (required()) {
            <span class="text-error ml-0.5">*</span>
          }
        </span>
        @if (helperText()) {
          <span class="label-text-alt text-base-content/50">{{ helperText() }}</span>
        }
      </div>
      <ng-content />
      @if (error()) {
        <div class="label pt-1">
          <span class="label-text-alt text-error" role="alert">{{ error() }}</span>
        </div>
      }
    </label>
  `,
})
export class FormFieldComponent {
  label = input.required<string>();
  error = input<string | null>(null);
  helperText = input<string | null>(null);
  required = input(false);
}
