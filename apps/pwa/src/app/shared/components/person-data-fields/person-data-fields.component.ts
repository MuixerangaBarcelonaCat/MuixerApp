import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { Gender } from '@muixer/shared';
import { PersonDataFormGroup, getCountryOptions } from '../../utils/person-data-form.util';

const GENDER_LABELS: Record<Gender, string> = {
  [Gender.FEMALE]: 'Dona',
  [Gender.MALE]: 'Home',
  [Gender.OTHER]: 'Altre / Preferisc no dir-ho',
};

@Component({
  selector: 'app-person-data-fields',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './person-data-fields.component.html',
})
export class PersonDataFieldsComponent {
  readonly formGroup = input.required<PersonDataFormGroup>();
  readonly heading = input<string>();

  protected readonly genders = [Gender.FEMALE, Gender.MALE, Gender.OTHER];
  protected readonly genderLabels = GENDER_LABELS;
  protected readonly countries = getCountryOptions();
}
