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
import { PersonInvitationModalComponent } from './modals/person-invitation-modal.component';
import { PersonLinkUserModalComponent } from './modals/person-link-user-modal.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    RouterModule,
    EmptyStateComponent,
    PersonInvitationModalComponent,
    PersonLinkUserModalComponent,
  ],
  templateUrl: './person-detail.component.html',
})
export class PersonDetailComponent implements OnInit {
  private readonly personService = inject(PersonService);
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

  invitationModalOpen = signal(false);
  linkUserModalOpen = signal(false);

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

  ngOnInit() {
    this.route.paramMap.subscribe((params) => {
      const id = params.get('id');
      if (id) {
        this.loadPerson(id);
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
    if (p) this.patchForm(p);
    this.saveError.set(null);
    this.editing.set(false);
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.saveError.set(null);
    this.saveSuccess.set(false);

    const id = this.route.snapshot.paramMap.get('id');
    const raw = this.form.getRawValue();

    const payload: Partial<UpdatePersonDto> = {
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

  protected readonly getFullName = getFullName;
}