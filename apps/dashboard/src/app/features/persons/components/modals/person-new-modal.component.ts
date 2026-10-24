import { ChangeDetectionStrategy, Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AccessStatus, DELEGATE_TYPE_LABELS } from '@muixer/shared';
import { AlertComponent, ButtonComponent, CheckboxComponent, InputComponent, ModalComponent } from '@muixer/ui';
import { PersonService } from '../../services/person.service';
import { PersonDelegateService } from '../../services/person-delegate.service';
import { CollaSettingsService } from '../../../../core/services/colla-settings.service';
import { Person } from '../../models/person.model';
import { InviteLinkPanelComponent } from '../invite-link-panel/invite-link-panel.component';
import {
  ResponsiblePickerComponent,
  ResponsibleSelection,
} from '../responsible-picker/responsible-picker.component';

type Step = 'alias' | 'invite' | 'responsible' | 'responsible-invite';

const SUBTITLES: Record<Step, string | null> = {
  alias: null,
  invite: "Accés a l'app",
  responsible: 'Persona responsable',
  'responsible-invite': 'Accés de la persona responsable',
};

/** The alias as people know it: provisional aliases carry a `~` prefix the API adds. */
const shownAlias = (alias: string) => alias.replace(/^~/, '');

/**
 * «Persona nova», guided: the provisional person, then how they get into the app. An adult gets an
 * invite link; a xicalla gets a responsible adult (who may need a link of their own). The person
 * exists from the first step, so leaving at any later one is safe.
 */
@Component({
  selector: 'app-person-new-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    AlertComponent,
    ButtonComponent,
    CheckboxComponent,
    InputComponent,
    ModalComponent,
    InviteLinkPanelComponent,
    ResponsiblePickerComponent,
  ],
  templateUrl: './person-new-modal.component.html',
})
export class PersonNewModalComponent {
  private readonly personService = inject(PersonService);
  private readonly delegateService = inject(PersonDelegateService);
  private readonly collaSettings = inject(CollaSettingsService);

  closed = output<void>();
  created = output<Person>();

  readonly alias = signal('');
  readonly isXicalla = signal(false);
  readonly step = signal<Step>('alias');
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  protected readonly majorityAge = computed(() => this.collaSettings.settings().majorityAge);
  protected readonly subtitle = computed(() => SUBTITLES[this.step()]);

  protected readonly person = signal<Person | null>(null);
  protected readonly personAlias = computed(() => shownAlias(this.alias().trim()));

  protected readonly responsibleSelection = signal<ResponsibleSelection | null>(null);
  protected readonly responsibleAlias = computed(() => {
    const selection = this.responsibleSelection();
    return selection ? shownAlias(selection.person.alias) : '';
  });
  protected readonly responsibleRelation = computed(() => {
    const selection = this.responsibleSelection();
    return selection ? DELEGATE_TYPE_LABELS[selection.delegateType].toLowerCase() : '';
  });

  private readonly invitePanel = viewChild(InviteLinkPanelComponent);
  protected readonly linkCreated = computed(() => !!this.invitePanel()?.link());
  protected readonly linkGenerating = computed(() => this.invitePanel()?.generating() ?? false);

  close(): void {
    if (this.saving()) return;
    this.closed.emit();
  }

  create(): void {
    const alias = this.alias().trim();
    if (!alias || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    this.personService.createProvisional(alias, this.isXicalla()).subscribe({
      next: (person) => {
        this.saving.set(false);
        this.person.set(person);
        this.created.emit(person);
        this.step.set(this.isXicalla() ? 'responsible' : 'invite');
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err?.error?.message ?? 'Error en crear la persona');
      },
    });
  }

  generateLink(): void {
    this.invitePanel()?.generate();
  }

  linkResponsible(): void {
    const person = this.person();
    const selection = this.responsibleSelection();
    if (!person || !selection || this.saving()) return;

    this.saving.set(true);
    this.error.set(null);
    this.delegateService
      .createDelegate(person.id, {
        responsiblePersonId: selection.person.id,
        delegateType: selection.delegateType,
        isPrimary: true,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          // An active adult can already get in; one with a live invite must keep the link they hold.
          const status = selection.person.accessStatus;
          if (status === AccessStatus.ACTIVE || status === AccessStatus.INVITED) this.closed.emit();
          else this.step.set('responsible-invite');
        },
        error: (err) => {
          this.saving.set(false);
          this.error.set(err?.error?.message ?? "No s'ha pogut vincular la persona responsable.");
        },
      });
  }
}
