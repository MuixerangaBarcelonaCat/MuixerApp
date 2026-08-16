import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { LucideAngularModule, Settings, Users, User } from 'lucide-angular';
import { ManagedPerson, PersonProfileSummary } from '@muixer/shared';
import { MobileHeaderComponent } from '../../shared/components/mobile-header/mobile-header.component';
import { PersonSwitcherComponent } from '../../shared/components/person-switcher/person-switcher.component';
import { PillBadgeComponent } from '../../shared/components/pill-badge/pill-badge.component';
import { SkeletonCardComponent } from '../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { DelegationsModalComponent } from './delegations-modal/delegations-modal.component';
import { AuthService } from '../../core/auth/services/auth.service';
import { ProfileService } from './services/profile.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    MobileHeaderComponent,
    PersonSwitcherComponent,
    PillBadgeComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    DelegationsModalComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  private readonly auth = inject(AuthService);
  private readonly profileService = inject(ProfileService);

  protected readonly SettingsIcon = Settings;
  protected readonly UsersIcon = Users;
  protected readonly UserIcon = User;

  /** Placeholder tiles — real stats are deferred (see implementation plan §5). */
  protected readonly statPlaceholders = ['Assajos', 'Actuacions', 'Assistència'];

  protected readonly selectedPersonId = signal<string | null>(
    this.auth.currentUser()?.person?.id ?? null,
  );

  protected readonly delegationsModalOpen = signal(false);

  protected readonly switcherResource = rxResource({
    stream: () => this.profileService.listSwitchablePersons(),
  });

  protected readonly switchablePersons = computed<ManagedPerson[]>(
    () => this.switcherResource.value() ?? [],
  );
  protected readonly showSwitcher = computed(() => this.switchablePersons().length > 1);

  protected readonly summaryResource = rxResource<PersonProfileSummary, string | undefined>({
    params: () => this.selectedPersonId() ?? undefined,
    stream: ({ params: personId }) => this.profileService.getPersonSummary(personId as string),
  });

  protected readonly summary = computed(() =>
    this.summaryResource.error() ? undefined : this.summaryResource.value(),
  );
  protected readonly isLoadingSummary = this.summaryResource.isLoading;

  protected selectPerson(personId: string): void {
    this.selectedPersonId.set(personId);
  }

  protected openDelegationsModal(): void {
    this.delegationsModalOpen.set(true);
  }

  protected closeDelegationsModal(): void {
    this.delegationsModalOpen.set(false);
  }

  protected delegationLabel(count: number): string {
    return count === 1 ? '1 delegació' : `${count} delegacions`;
  }
}
