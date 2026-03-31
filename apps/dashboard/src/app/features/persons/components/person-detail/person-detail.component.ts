import { Component, ChangeDetectionStrategy, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { PersonService } from '../../services/person.service';
import { Person } from '../../models/person.model';
import {
  getFullName,
  getAvailabilityLabel,
  getOnboardingLabel,
  getContrastColor,
  formatDate,
  formatDateTime,
} from '../../../../shared/utils';

@Component({
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  templateUrl: './person-detail.component.html',
  styleUrls: ['./person-detail.component.scss'],
})
export class PersonDetailComponent implements OnInit {
  private readonly personService = inject(PersonService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  person = signal<Person | null>(null);
  loading = signal(false);
  metadataExpanded = false;

  // Expose utility functions for template
  readonly getFullName = getFullName;
  readonly getAvailabilityLabel = getAvailabilityLabel;
  readonly getOnboardingLabel = getOnboardingLabel;
  readonly getContrastColor = getContrastColor;
  readonly formatDate = formatDate;
  readonly formatDateTime = formatDateTime;

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadPerson(id);
    }
  }

  goBack() {
    this.router.navigate(['/persons']);
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
