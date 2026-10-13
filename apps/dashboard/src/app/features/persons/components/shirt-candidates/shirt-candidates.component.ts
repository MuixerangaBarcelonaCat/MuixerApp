import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import {
  AlertComponent,
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  DOMAIN_ICONS,
  EmptyStateComponent,
  InputComponent,
  ModalComponent,
  ToastService,
} from '@muixer/ui';
import { SHIRT_REQUIREMENTS, ShirtCandidate, shirtProgress } from '@muixer/shared';
import { PersonService } from '../../services/person.service';
import { PageHeaderComponent } from '../../../../shared/components/data/page-header/page-header.component';
import { getFullName } from '../../../../shared/utils';

const PIP_CLASSES: Record<'met' | 'pending', string> = {
  met: 'bg-success text-success-content',
  pending: 'border border-base-content/20 text-base-content/30',
};

/** Data local d'avui en format `YYYY-MM-DD` (el que espera un `<input type="date">`). */
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

const plural = (n: number, singular: string, pluralForm: string) => `${n} ${n === 1 ? singular : pluralForm}`;

/**
 * Persones sense camisa: primer qui ja hi té dret (2 actuacions + 6 assajos amb assistència
 * marcada), després la resta de més a menys a prop. En lliurar-la, la data passa a ser la seua
 * `shirtDate` i la persona desapareix de la llista. També es pot lliurar a qui encara no compleix
 * els requisits (excepcions de la tècnica), amb un avís al diàleg.
 */
@Component({
  selector: 'app-shirt-candidates',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    LucideAngularModule,
    AlertComponent,
    BadgeComponent,
    ButtonComponent,
    CardComponent,
    EmptyStateComponent,
    InputComponent,
    ModalComponent,
    PageHeaderComponent,
  ],
  templateUrl: './shirt-candidates.component.html',
})
export class ShirtCandidatesComponent {
  private readonly personService = inject(PersonService);
  private readonly toast = inject(ToastService);

  protected readonly ICONS = DOMAIN_ICONS;
  protected readonly REQUIREMENTS = SHIRT_REQUIREMENTS;
  protected readonly getFullName = getFullName;
  protected readonly today = localToday();

  readonly candidates = signal<ShirtCandidate[]>([]);
  readonly loading = signal(true);
  readonly eligible = computed(() => this.candidates().filter((c) => c.isEligible));
  readonly inProgress = computed(() => this.candidates().filter((c) => !c.isEligible));

  readonly awarding = signal<ShirtCandidate | null>(null);
  readonly awardDate = signal(localToday());
  readonly saving = signal(false);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.personService.getShirtCandidates().subscribe({
      next: (candidates) => {
        this.candidates.set(candidates);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error("No s'han pogut carregar les persones pendents de camisa.");
      },
    });
  }

  /** Una marca per esdeveniment requerit; plena si ja hi ha anat. */
  pips(attended: number, required: number): boolean[] {
    return Array.from({ length: required }, (_, i) => i < attended);
  }

  pipClass(filled: boolean): string {
    return PIP_CLASSES[filled ? 'met' : 'pending'];
  }

  /** «li falten 1 actuació i 2 assajos» — només els tipus que encara no compleix. */
  missingText(candidate: ShirtCandidate): string {
    const { missingPerformances, missingRehearsals } = shirtProgress(candidate);
    const parts: string[] = [];
    if (missingPerformances > 0) parts.push(plural(missingPerformances, 'actuació', 'actuacions'));
    if (missingRehearsals > 0) parts.push(plural(missingRehearsals, 'assaig', 'assajos'));
    const verb = parts.length === 1 && missingPerformances + missingRehearsals === 1 ? 'falta' : 'falten';
    return `li ${verb} ${parts.join(' i ')}`;
  }

  openAward(candidate: ShirtCandidate): void {
    this.awardDate.set(localToday());
    this.awarding.set(candidate);
  }

  closeAward(): void {
    if (this.saving()) return;
    this.awarding.set(null);
  }

  confirmAward(): void {
    const candidate = this.awarding();
    if (!candidate || !this.awardDate()) return;

    this.saving.set(true);
    this.personService.update(candidate.id, { shirtDate: this.awardDate() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.awarding.set(null);
        this.toast.success(`S'ha lliurat la camisa a ${candidate.alias}.`);
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.toast.error("No s'ha pogut lliurar la camisa.");
      },
    });
  }
}
