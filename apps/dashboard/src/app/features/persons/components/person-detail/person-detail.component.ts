import { PersonAssignmentEntry } from '@muixer/pinyes-render';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { Person, UpdatePersonDto } from '../../models/person.model';
import {
  ToastService,
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  EmptyStateComponent,
  FormFieldComponent,
  InputComponent,
  ModalComponent,
  SelectComponent,
} from '@muixer/ui';
import { TagService } from '../../../config/services/tag.service';
import { TagWithCount } from '../../../config/models/tag.model';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { Season } from '../../../events/models/event.model';
import { formatNodeCordonLabel } from '../../../pinyes/utils/node-cordon-label.util';

import {
  getAvailabilityLabel,
  getOnboardingLabel,
  formatDate,
  formatDateTime,
  formatShoulderHeightRelative,
  getFullName,
} from '../../../../shared/utils';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { PersonDelegateModalComponent } from './modals/person-delegate-modal.component';
import { EmojiPickerComponent } from '../../../../shared/components/forms/emoji-picker/emoji-picker.component';
import {
  PersonDelegateService,
  PersonDelegateItem,
} from '../../services/person-delegate.service';
import { LegalDocumentService } from '../../../../core/services/legal-document.service';
import { DelegateType, Gender, LegalDocumentType, TAG_CATEGORY_LABELS, TagCategory } from '@muixer/shared';

/** Same options and labels as the PWA onboarding form (person-data-fields). */
const GENDER_LABELS: Record<Gender, string> = {
  [Gender.FEMALE]: 'Dona',
  [Gender.MALE]: 'Home',
  [Gender.OTHER]: 'Altre / Preferisc no dir-ho',
};

type NotesChoice = 'LESIO' | 'SENSE_CARREGA' | 'RESTRICCIO_HORARIA' | 'CUIDA_XICALLA' | 'ALTRE';

/** Emoji preselected when the free-text "Altre" option is chosen. */
const DEFAULT_CUSTOM_NOTES_EMOJI = '❗️';

const NOTES_PRESETS: { choice: Exclude<NotesChoice, 'ALTRE'>; emoji: string; text: string }[] = [
  { choice: 'LESIO', emoji: '🤕', text: 'Baixa llarga' },
  { choice: 'SENSE_CARREGA', emoji: '🍃', text: 'Sense càrrega' },
  { choice: 'RESTRICCIO_HORARIA', emoji: '⏰️', text: 'Restricció horària' },
  { choice: 'CUIDA_XICALLA', emoji: '🐣', text: 'Cuida xicalla' },
];

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    CheckboxComponent,
    EmptyStateComponent,
    FormFieldComponent,
    InputComponent,
    ModalComponent,
    SelectComponent,
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

  readonly ICON_USER_X = DOMAIN_ICONS.USER_X;

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
  deletingPerson = signal(false);
  metadataExpanded = signal(false);
  editing = signal(false);

  allPositions = signal<TagWithCount[]>([]);
  selectedPositionIds = signal<string[]>([]);

  /** Edit-mode tag chips grouped Pinya / Tronc / Altres; XICALLA tags fall under Altres. */
  readonly positionGroups = computed(() => {
    const groups = [TagCategory.PINYA, TagCategory.TRONC, TagCategory.ALTRES].map((category) => ({
      category,
      label: TAG_CATEGORY_LABELS[category],
      tags: [] as TagWithCount[],
    }));
    for (const tag of this.allPositions()) {
      const target = groups.find((g) => g.category === tag.category) ?? groups[groups.length - 1];
      target.tags.push(tag);
    }
    return groups.filter((g) => g.tags.length > 0);
  });

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
    gender: ['' as Gender | ''],
    notes: [''],
    notesEmoji: [null as string | null],
    isActive: [true],
    isMember: [false],
    isXicalla: [false],
    availability: ['AVAILABLE'],
    onboardingStatus: ['IN_PROGRESS'],
    shirtDate: [''],
  });

  protected readonly genders = [Gender.FEMALE, Gender.MALE, Gender.OTHER];
  protected readonly genderLabels = GENDER_LABELS;
  getGenderLabel(gender: Gender | null): string {
    return gender ? GENDER_LABELS[gender] : '';
  }

  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getOnboardingLabel = getOnboardingLabel;
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

  /** Observation suggestions; each one is stored as the usual `notes` text + `notesEmoji` pair. */
  protected readonly notesPresets = NOTES_PRESETS;
  notesChoice = signal<NotesChoice | null>(null);

  // Typing in the text field is a customisation of whatever suggestion is active. Programmatic
  // updates (picking a chip, loading a person) patch with `emitEvent: false` so they don't count.
  private readonly notesTextEdits = this.form.controls.notes.valueChanges
    .pipe(takeUntilDestroyed())
    .subscribe(() => this.markNotesCustomised());

  private markNotesCustomised(): void {
    if (this.notesChoice() !== null) this.notesChoice.set('ALTRE');
  }

  selectNotesChoice(choice: NotesChoice): void {
    if (this.notesChoice() === choice) {
      this.notesChoice.set(null);
      this.form.patchValue({ notes: '', notesEmoji: null }, { emitEvent: false });
      return;
    }
    this.notesChoice.set(choice);
    const preset = NOTES_PRESETS.find((p) => p.choice === choice);
    this.form.patchValue(
      { notes: preset?.text ?? '', notesEmoji: preset?.emoji ?? DEFAULT_CUSTOM_NOTES_EMOJI },
      { emitEvent: false },
    );
  }

  private notesChoiceFor(notes: string | null, emoji: string | null): NotesChoice | null {
    if (!notes && !emoji) return null;
    return NOTES_PRESETS.find((p) => p.text === notes && p.emoji === emoji)?.choice ?? 'ALTRE';
  }

  onNotesEmojiChange(emoji: string | null): void {
    this.form.patchValue({ notesEmoji: emoji });
    this.markNotesCustomised();
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
      gender: (raw.gender as Gender) || null,
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
      gender: person.gender ?? '',
      notes: person.notes ?? '',
      notesEmoji: person.notesEmoji ?? null,
      isActive: person.isActive,
      isMember: person.isMember,
      isXicalla: person.isXicalla,
      availability: person.availability,
      onboardingStatus: person.onboardingStatus,
      shirtDate: person.shirtDate ?? '',
    });
    this.notesChoice.set(this.notesChoiceFor(person.notes, person.notesEmoji));
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