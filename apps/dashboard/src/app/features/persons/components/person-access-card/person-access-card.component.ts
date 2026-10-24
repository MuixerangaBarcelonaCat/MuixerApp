import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AccessStatus, DELEGATE_TYPE_LABELS, resolveAccessStatus } from '@muixer/shared';
import { ButtonComponent, ModalComponent } from '@muixer/ui';
import { Person } from '../../models/person.model';
import { PersonDelegateItem } from '../../services/person-delegate.service';
import { formatValenciaDateAndTime } from '../../../../shared/utils';
import { AccessStatusBadgeComponent } from '../access-status-badge/access-status-badge.component';
import { InviteLinkPanelComponent } from '../invite-link-panel/invite-link-panel.component';

interface InviteTarget {
  personId: string;
  alias: string;
}

/**
 * «Accés a l'app» on a person's profile: one state (`accessStatus`) and the one action that moves
 * it on. Owns the invite flow (confirm, then the link shown once); the responsible's own modal and
 * its removal belong to the profile, reached through the outputs.
 */
@Component({
  selector: 'app-person-access-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ButtonComponent, ModalComponent, AccessStatusBadgeComponent, InviteLinkPanelComponent],
  templateUrl: './person-access-card.component.html',
})
export class PersonAccessCardComponent {
  protected readonly AccessStatus = AccessStatus;

  person = input.required<Person>();
  /** The person's primary delegate, if any. */
  responsible = input<PersonDelegateItem | null>(null);
  editing = input(false);

  defineResponsible = output<void>();
  removeResponsible = output<PersonDelegateItem>();
  /** An invite link was created: the profile reloads to show the new state. */
  changed = output<void>();

  protected readonly status = computed(() => this.person().accessStatus);
  protected readonly ownExpiry = computed(() => {
    const expiresAt = this.person().user?.inviteExpiresAt;
    return expiresAt ? formatValenciaDateAndTime(expiresAt) : null;
  });

  protected readonly responsibleAlias = computed(() => this.responsible()?.user.person?.alias ?? null);
  protected readonly responsibleRelation = computed(() => {
    const r = this.responsible();
    return r ? DELEGATE_TYPE_LABELS[r.delegateType].toLowerCase() : '';
  });
  protected readonly responsibleStatus = computed(() => {
    const r = this.responsible();
    return r ? resolveAccessStatus({ user: r.user, hasResponsible: false }, new Date()) : null;
  });

  protected readonly confirmTarget = signal<InviteTarget | null>(null);
  protected readonly inviteTarget = signal<InviteTarget | null>(null);

  /** Invite the person themselves; `confirm` when a live link would stop working. */
  inviteSelf(confirm: boolean): void {
    this.open({ personId: this.person().id, alias: this.person().alias }, confirm);
  }

  inviteResponsible(): void {
    const r = this.responsible();
    if (!r?.user.person) return;
    this.open(
      { personId: r.user.person.id, alias: r.user.person.alias },
      this.responsibleStatus() === AccessStatus.INVITED,
    );
  }

  confirmRegenerate(): void {
    this.inviteTarget.set(this.confirmTarget());
    this.confirmTarget.set(null);
  }

  private open(target: InviteTarget, confirm: boolean): void {
    if (confirm) this.confirmTarget.set(target);
    else this.inviteTarget.set(target);
  }
}
