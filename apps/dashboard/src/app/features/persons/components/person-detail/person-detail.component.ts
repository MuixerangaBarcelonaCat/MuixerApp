import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  OnInit,
  computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule, RouterLink } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { Person, UpdatePersonDto } from '../../models/person.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { PositionService } from '../../../config/services/position.service';
import { PositionWithCount } from '../../../config/models/position.model';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { PersonAssignmentEntry } from '../../../pinyes/models/assignment.model';
import { Season } from '../../../events/models/event.model';

import {
  getAvailabilityLabel,
  getOnboardingLabel,
  getContrastColor,
  formatDate,
  formatDateTime,
  formatShoulderHeightRelative,
  getFullName,
} from '../../../../shared/utils';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { PersonInvitationModalComponent } from './modals/person-invitation-modal.component';
import { PersonLinkUserModalComponent } from './modals/person-link-user-modal.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    EmptyStateComponent,
    PaginationComponent,
    PersonInvitationModalComponent,
    PersonLinkUserModalComponent,
  ],
  templateUrl: './person-detail.component.html',
})
export class PersonDetailComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly positionService = inject(PositionService);
  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly seasonService = inject(SeasonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  person = signal<Person | null>(null);
  loading = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);
  togglingProvisional = signal(false);
  provisionalToggleError = signal<string | null>(null);
  deletingPerson = signal(false);
  metadataExpanded = signal(false);
  editing = signal(false);

  isNew = computed(() => !this.route.snapshot.paramMap.get('id'));

  allPositions = signal<PositionWithCount[]>([]);
  selectedPositionIds = signal<string[]>([]);

  invitationModalOpen = signal(false);
  linkUserModalOpen = signal(false);

  // ── F3 History ──
  historyEntries = signal<PersonAssignmentEntry[]>([]);
  historyLoading = signal(false);
  historyPage = signal(1);
  historyTotal = signal(0);
  historyLimit = signal(20);
  historySeasonId = signal<string | undefined>(undefined);
  historyExpanded = signal(true);
  seasons = signal<Season[]>([]);

  form = this.fb.group({
    name: ['', Validators.required],
    firstSurname: [''],
    secondSurname: [''],
    alias: ['', Validators.required],
    phone: [''],
    birthDate: [''],
    shoulderHeight: [null as number | null],
    notes: [''],
    isActive: [true],
    isMember: [false],
    isXicalla: [false],
    availability: ['AVAILABLE'],
    onboardingStatus: ['IN_PROGRESS'],
    shirtDate: [''],
  });

  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getOnboardingLabel = getOnboardingLabel;
  readonly getContrastColor = getContrastColor;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatShoulderHeightRelative = formatShoulderHeightRelative;
  readonly Math = Math;

  ngOnInit() {
    this.positionService.getAll().subscribe({
      next: (positions) => this.allPositions.set(positions),
    });

    this.seasonService.getAll().subscribe({
      next: (res) => this.seasons.set(res.data),
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadPerson(id);
        this.loadHistory();
      } else {
        this.editing.set(true);
      }
    });
  }

  goBack() {
    this.router.navigate(['/persons']);
  }

  startEditing() {
    this.saveSuccess.set(false);
    this.saveError.set(null);
    this.editing.set(true);
  }

  cancelEditing() {
    const p = this.person();
    if (p) {
      this.patchForm(p);
      this.selectedPositionIds.set(p.positions.map(pos => pos.id));
    }
    this.saveError.set(null);
    this.editing.set(false);
  }

  togglePosition(positionId: string): void {
    this.selectedPositionIds.update(ids =>
      ids.includes(positionId) ? ids.filter(id => id !== positionId) : [...ids, positionId],
    );
  }

  isPositionSelected(positionId: string): boolean {
    return this.selectedPositionIds().includes(positionId);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const id = this.route.snapshot.paramMap.get('id');
    const raw = this.form.getRawValue();

    const payload: Partial<UpdatePersonDto> & { positionIds?: string[] } = {
      name: raw.name ?? undefined,
      firstSurname: raw.firstSurname ?? undefined,
      secondSurname: raw.secondSurname ?? undefined,
      alias: raw.alias ?? undefined,
      phone: raw.phone ?? undefined,
      birthDate: raw.birthDate || undefined,
      shoulderHeight: raw.shoulderHeight ?? undefined,
      notes: raw.notes ?? undefined,
      isActive: raw.isActive ?? undefined,
      isMember: raw.isMember ?? undefined,
      isXicalla: raw.isXicalla ?? undefined,
      availability: (raw.availability as Person['availability']) ?? undefined,
      onboardingStatus:
        (raw.onboardingStatus as Person['onboardingStatus']) ?? undefined,
      shirtDate: raw.shirtDate || null,
      positionIds: this.selectedPositionIds(),
    };

    const request$ = id
      ? this.personService.update(id, payload)
      : this.personService.createProvisional(raw.alias!);

    request$.subscribe({
      next: (updated) => {
        this.person.set(updated);
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.editing.set(false);
        if (!id) this.router.navigate(['/persons', updated.id]);
      },
      error: (err) => {
        this.saving.set(false);
        this.saveError.set(err?.error?.message ?? 'Error en desar els canvis');
      },
    });
  }

  toggleProvisional() {
    const p = this.person();
    if (!p || this.togglingProvisional()) return;
    const newValue = !p.isProvisional;
    if (
      !newValue &&
      !confirm(
        'Per promoure una persona provisional a membre regular necessites confirmar que té nom, cognom i àlies definitius configurats.',
      )
    )
      return;
    this.togglingProvisional.set(true);
    this.provisionalToggleError.set(null);
    this.personService.update(p.id, { isProvisional: newValue }).subscribe({
      next: (updated) => {
        this.person.set(updated);
        this.togglingProvisional.set(false);
        this.toast.success(newValue ? 'Persona marcada com a provisional.' : 'Persona promoguda a membre regular.');
      },
      error: (err) => {
        this.togglingProvisional.set(false);
        const msg = err?.error?.message ?? 'Error en canviar l\'estat provisional';
        this.provisionalToggleError.set(msg);
        this.toast.error(msg);
      },
    });
  }

  private loadPerson(id: string) {
    this.loading.set(true);
    this.personService.getOne(id).subscribe({
      next: (person) => {
        this.person.set(person);
        this.patchForm(person);
        this.selectedPositionIds.set(person.positions.map(p => p.id));
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading person', err);
        this.loading.set(false);
      },
    });
  }

  private patchForm(person: Person) {
    this.form.patchValue({
      name: person.name ?? '',
      firstSurname: person.firstSurname ?? '',
      secondSurname: person.secondSurname ?? '',
      alias: person.alias ?? '',
      phone: person.phone ?? '',
      birthDate: person.birthDate ?? '',
      shoulderHeight: person.shoulderHeight ?? null,
      notes: person.notes ?? '',
      isActive: person.isActive,
      isMember: person.isMember,
      isXicalla: person.isXicalla,
      availability: person.availability,
      onboardingStatus: person.onboardingStatus,
      shirtDate: person.shirtDate ?? '',
    });
  }

  startSendingInvitation() {
    this.invitationModalOpen.set(true);
  }

  startLinkingToUser() {
    this.linkUserModalOpen.set(true);
  }

  onInvitationSuccess() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadPerson(id);
    this.invitationModalOpen.set(false);
  }

  onLinkUserSuccess() {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.loadPerson(id);
    this.linkUserModalOpen.set(false);
  }

  // ── F3 History ──

  loadHistory() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.historyLoading.set(true);
    this.nodeAssignmentService
      .getPersonHistory(id, {
        page: this.historyPage(),
        limit: this.historyLimit(),
        seasonId: this.historySeasonId(),
      })
      .subscribe({
        next: (res) => {
          this.historyEntries.set(res.data);
          this.historyTotal.set(res.meta.total);
          this.historyLoading.set(false);
        },
        error: () => this.historyLoading.set(false),
      });
  }

  onHistoryPageChange(page: number) {
    this.historyPage.set(page);
    this.loadHistory();
  }

  onHistorySeasonChange(seasonId: string) {
    this.historySeasonId.set(seasonId || undefined);
    this.historyPage.set(1);
    this.loadHistory();
  }

  navigateToEvent(entry: PersonAssignmentEntry) {
    const base = entry.eventType === 'ACTUACIO' ? '/performances' : '/rehearsals';
    this.router.navigate([base, entry.eventId]);
  }

  protected readonly getFullName = getFullName;
}