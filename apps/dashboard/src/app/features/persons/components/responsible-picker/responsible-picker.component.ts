import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DELEGATE_TYPE_LABELS, DelegateType } from '@muixer/shared';
import { AlertComponent, ButtonComponent, FormFieldComponent, InputComponent, SelectComponent } from '@muixer/ui';
import { PersonSearchInputComponent } from '../../../../shared/components/forms/person-search-input/person-search-input.component';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';
import { AccessStatusBadgeComponent } from '../access-status-badge/access-status-badge.component';

export interface ResponsibleSelection {
  person: Person;
  delegateType: DelegateType;
}

/** The API only accepts a parent or guardian as a xicalla's responsible person. */
const XICALLA_TYPES = [DelegateType.PARENT, DelegateType.GUARDIAN];
const ALL_TYPES = [DelegateType.PARENT, DelegateType.GUARDIAN, DelegateType.OTHER];

/**
 * Chooses who becomes a person's responsible: an adult found by search, or one created on the spot
 * as provisional. Reports the choice through `selectionChange` (`null` while incomplete); the
 * caller owns the button that links them, so it can sit in a modal footer or a wizard step.
 */
@Component({
  selector: 'app-responsible-picker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AlertComponent,
    ButtonComponent,
    FormFieldComponent,
    InputComponent,
    SelectComponent,
    PersonSearchInputComponent,
    AccessStatusBadgeComponent,
  ],
  templateUrl: './responsible-picker.component.html',
})
export class ResponsiblePickerComponent {
  private readonly personService = inject(PersonService);

  /** The person who gets a responsible: never offered as their own. */
  personId = input.required<string>();
  isXicalla = input.required<boolean>();

  selectionChange = output<ResponsibleSelection | null>();

  protected readonly delegateTypes = computed(() =>
    (this.isXicalla() ? XICALLA_TYPES : ALL_TYPES).map((value) => ({ value, label: DELEGATE_TYPE_LABELS[value] })),
  );
  protected readonly excludeIds = computed(() => [this.personId()]);

  protected readonly selectedPerson = signal<Person | null>(null);
  protected readonly selectedType = signal<DelegateType>(DelegateType.PARENT);

  protected readonly creating = signal(false);
  protected readonly newAlias = signal('');
  protected readonly saving = signal(false);
  protected readonly createError = signal<string | null>(null);

  onTypeChange(value: string): void {
    this.selectedType.set(value as DelegateType);
    this.emit();
  }

  pick(person: Person): void {
    this.selectedPerson.set(person);
    this.emit();
  }

  clear(): void {
    this.selectedPerson.set(null);
    this.emit();
  }

  openCreate(): void {
    this.creating.set(true);
    this.createError.set(null);
  }

  cancelCreate(): void {
    this.creating.set(false);
    this.newAlias.set('');
  }

  createAdult(): void {
    const alias = this.newAlias().trim();
    if (!alias || this.saving()) return;
    this.saving.set(true);
    this.createError.set(null);
    this.personService.createProvisional(alias, false).subscribe({
      next: (person) => {
        this.saving.set(false);
        this.cancelCreate();
        this.pick(person);
      },
      error: (err) => {
        this.saving.set(false);
        this.createError.set(err?.error?.message ?? "No s'ha pogut crear la persona.");
      },
    });
  }

  private emit(): void {
    const person = this.selectedPerson();
    this.selectionChange.emit(person ? { person, delegateType: this.selectedType() } : null);
  }
}
