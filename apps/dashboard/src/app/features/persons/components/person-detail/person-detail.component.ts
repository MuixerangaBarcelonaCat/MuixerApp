import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { PersonService } from '../../services/person.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { Person } from '../../models/person.model';
import {
  getFullName,
  getAvailabilityLabel,
  getOnboardingLabel,
  getContrastColor,
  formatDate,
  formatDateTime,
  formatShoulderHeightRelative,
} from '../../../../shared/utils';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './person-detail.component.html',
})
export class PersonDetailComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  person = signal<Person | null>(null);
  loading = signal(false);
  metadataExpanded = false;
  togglingProvisional = signal(false);
  provisionalToggleError = signal<string | null>(null);

  // Expose utility functions for template
  readonly getFullName = getFullName;
  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getOnboardingLabel = getOnboardingLabel;
  readonly getContrastColor = getContrastColor;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;
  readonly formatShoulderHeightRelative = formatShoulderHeightRelative;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPerson(id);
    }
  }

  goBack() {
    this.router.navigate(['/persons']);
  }

  toggleProvisional() {
    const p = this.person();
    if (!p || this.togglingProvisional()) return;

    const newValue = !p.isProvisional;
    if (newValue === false) {
      // Promoting provisional to member requires real name/alias, so redirect to edit flow
      if (!confirm('Per promoure una persona provisional a membre regular necessites confirmar que té nom, cognom i àlies definitius configurats.')) {
        return;
      }
    }

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
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading person', err);
        this.loading.set(false);
      },
    });
  }
}
