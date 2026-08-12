import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { Person, UpdatePersonDto } from '../../models/person.model';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { TagService } from '../../../config/services/tag.service';
import { TagWithCount } from '../../../config/models/tag.model';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { PersonAssignmentEntry } from '../../../pinyes/models/assignment.model';
import { Season } from '../../../events/models/event.model';
import { formatNodeCordonLabel } from '../../../pinyes/utils/node-cordon-label.util';

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
import { PersonDelegateModalComponent } from './modals/person-delegate-modal.component';
import { EmojiPickerComponent } from '../../../../shared/components/forms/emoji-picker/emoji-picker.component';
import {
  PersonDelegateService,
  PersonDelegateItem,
} from '../../services/person-delegate.service';
import { LegalDocumentService } from '../../../../core/services/legal-document.service';
import { DelegateType, LegalDocumentType } from '@muixer/shared';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    EmptyStateComponent,
    PaginationComponent,
    PersonDelegateModalComponent,
    EmojiPickerComponent,
  ],
  templateUrl: './person-detail.component.html',
})
export class PersonDetailComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly tagService = inject(TagService);
  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly seasonService = inject(SeasonService);
  private readonly delegateService = inject(PersonDelegateService);
  private readonly legalService = inject(LegalDocumentService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);

  person = signal<Person | null>(null);

  /** Informative transparency clause (art. 13 RGPD) shown while editing personal data. */
  readonly transparencyClause = signal<string | null>(null);

  /** Full name shown under the alias in the header, or '' when it would just
   *  repeat the alias (e.g. provisional members whose name equals the alias). */
  readonly headerSubtitle = computed(() => {
    const p = this.person();
    if (!p) return '';
    const full = [p.name, p.firstSurname, p.secondSurname].filter(Boolean).join(' ').trim();
    return full && full !== p.alias ? full : '';
  });

  loading = signal(false);
  saving = signal(false);
  saveError = signal<string | null>(null);
  saveSuccess = signal(false);
  togglingProvisional = signal(false);
  provisionalToggleError = signal<string | null>(null);
  deletingPerson = signal(false);
  metadataExpanded = signal(false);
  editing = signal(false);

  allPositions = signal<TagWithCount[]>([]);
  selectedPositionIds = signal<string[]>([]);

  creatingInviteLink = signal(false);
  delegateModalOpen = signal(false);
  delegateModalIsPrimary = signal(false);

  // ── Delegates ──
  delegates = signal<PersonDelegateItem[]>([]);
  delegatesLoading = signal(false);
  removingDelegateId = signal<string | null>(null);
  existingDelegateUserIds = computed(() => this.delegates().map((d) => d.user.id));
  primaryDelegate = computed(() => this.delegates().find((d) => d.isPrimary) ?? null);
  secondaryDelegates = computed(() => this.delegates().filter((d) => !d.isPrimary));

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
    notesEmoji: [null as string | null],
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
  readonly formatNodeCordonLabel = formatNodeCordonLabel;
  readonly Math = Math;

  ngOnInit() {
    this.tagService.getAll().subscribe({
      next: (tags) => this.allPositions.set(tags),
    });

    this.seasonService.getAll().subscribe({
      next: (res) => this.seasons.set(res.data),
    });

    this.legalService.getActive(LegalDocumentType.TRANSPARENCY_CLAUSE).subscribe({
      next: (doc) => this.transparencyClause.set(doc.content),
      error: () => this.transparencyClause.set(null),
    });

    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      // No dedicated "create" route exists — `/persons/new` falls through to
      // this `:id` route with the literal id "new", which the API rejects as
      // an invalid UUID (WI-23). Nothing currently links to that URL; skip
      // the doomed fetches rather than logging a 400 on every load.
      if (id && id !== 'new') {
        this.loadPerson(id);
        this.loadHistory();
        this.loadDelegates();
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

  onNotesEmojiChange(emoji: string | null): void {
    this.form.patchValue({ notesEmoji: emoji });
  }

  isPositionSelected(positionId: string): boolean {
    return this.selectedPositionIds().includes(positionId);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const id = this.route.snapshot.paramMap.get('id')!;
    const raw = this.form.getRawValue();

    const payload: Partial<UpdatePersonDto> & { positionIds?: string[] } = {
      name: raw.name ?? undefined,
      firstSurname: raw.firstSurname ?? undefined,
      secondSurname: raw.secondSurname ?? undefined,
      alias: raw.alias ?? undefined,
      phone: raw.phone ?? undefined,
      birthDate: raw.birthDate || undefined,
      shoulderHeight: raw.shoulderHeight || null,
      notes: raw.notes ?? undefined,
      notesEmoji: raw.notesEmoji ?? null,
      isActive: raw.isActive ?? undefined,
      isMember: raw.isMember ?? undefined,
      isXicalla: raw.isXicalla ?? undefined,
      availability: (raw.availability as Person['availability']) ?? undefined,
      onboardingStatus:
        (raw.onboardingStatus as Person['onboardingStatus']) ?? undefined,
      shirtDate: raw.shirtDate || null,
      positionIds: this.selectedPositionIds(),
    };

    this.personService.update(id, payload).subscribe({
      next: (updated) => {
        this.person.set(updated);
        this.saving.set(false);
        this.saveSuccess.set(true);
        this.editing.set(false);
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
      shoulderHeight: person.shoulderHeight || null,
      notes: person.notes ?? '',
      notesEmoji: person.notesEmoji ?? null,
      isActive: person.isActive,
      isMember: person.isMember,
      isXicalla: person.isXicalla,
      availability: person.availability,
      onboardingStatus: person.onboardingStatus,
      shirtDate: person.shirtDate ?? '',
    });
  }

  createInviteLink() {
    const p = this.person();
    if (!p || this.creatingInviteLink()) return;

    this.creatingInviteLink.set(true);
    this.personService.createInviteLink(p.id).subscribe({
      next: async ({ inviteUrl }) => {
        this.creatingInviteLink.set(false);
        const copied = await this.copyToClipboard(inviteUrl);
        this.toast.success(
          copied
            ? 'Enllaç d\'invitació copiat al portapapers.'
            : `Enllaç d'invitació: ${inviteUrl}`,
        );
        const id = this.route.snapshot.paramMap.get('id');
        if (id) this.loadPerson(id);
      },
      error: (err) => {
        this.creatingInviteLink.set(false);
        this.toast.error(err?.error?.message ?? 'Error en crear l\'enllaç d\'invitació');
      },
    });
  }

  private async copyToClipboard(text: string): Promise<boolean> {
    if (!navigator.clipboard) return false;
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
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
    this.router.navigate(['/events', entry.eventId]);
  }

  // ── Delegates ──

  private static readonly DELEGATE_TYPE_LABELS: Record<DelegateType, string> = {
    [DelegateType.PARENT]: 'Pare/Mare',
    [DelegateType.PARTNER]: 'Parella',
    [DelegateType.GUARDIAN]: 'Tutor/a',
    [DelegateType.OTHER]: 'Altres',
  };

  getDelegateTypeLabel(type: DelegateType): string {
    return PersonDetailComponent.DELEGATE_TYPE_LABELS[type] ?? type;
  }

  loadDelegates(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.delegatesLoading.set(true);
    this.delegateService.getByPerson(id).subscribe({
      next: (delegates) => {
        this.delegates.set(delegates);
        this.delegatesLoading.set(false);
      },
      error: () => this.delegatesLoading.set(false),
    });
  }

  openDelegateModal(isPrimary = false): void {
    this.delegateModalIsPrimary.set(isPrimary);
    this.delegateModalOpen.set(true);
  }

  onDelegateAdded(): void {
    this.delegateModalOpen.set(false);
    this.loadDelegates();
    this.toast.success('Delegat afegit correctament.');
  }

  confirmingDelegateRemoval = signal<PersonDelegateItem | null>(null);

  askRemoveDelegate(delegate: PersonDelegateItem): void {
    this.confirmingDelegateRemoval.set(delegate);
  }

  cancelRemoveDelegate(): void {
    this.confirmingDelegateRemoval.set(null);
  }

  confirmRemoveDelegate(): void {
    const delegate = this.confirmingDelegateRemoval();
    if (!delegate || this.removingDelegateId()) return;

    this.confirmingDelegateRemoval.set(null);
    this.removingDelegateId.set(delegate.id);
    const personId = this.route.snapshot.paramMap.get('id')!;
    this.delegateService.removeDelegate(personId, delegate.id).subscribe({
      next: () => {
        this.removingDelegateId.set(null);
        this.loadDelegates();
        this.toast.success('S\'ha eliminat la delegació.');
      },
      error: (err) => {
        this.removingDelegateId.set(null);
        this.toast.error(
          err?.error?.message ?? 'No s\'ha pogut eliminar la delegació.',
        );
      },
    });
  }

  protected readonly getFullName = getFullName;
}