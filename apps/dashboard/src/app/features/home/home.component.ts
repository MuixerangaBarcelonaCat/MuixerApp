import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EventService } from '../events/services/event.service';
import { PersonService } from '../persons/services/person.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { EventListItem, EventType } from '../events/models/event.model';
import { EmptyStateComponent } from '../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule, EmptyStateComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly personService = inject(PersonService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly displayName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return null;
    return u.person?.alias || u.person?.name || u.email;
  });

  nextRehearsal = signal<EventListItem | null>(null);
  nextPerformance = signal<EventListItem | null>(null);
  totalPersons = signal<number | null>(null);
  totalRehearsals = signal<number | null>(null);
  totalPerformances = signal<number | null>(null);

  loading = signal(true);

  ngOnInit(): void {
    this.loadData();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  private loadData(): void {
    this.loading.set(true);

    // Next rehearsal
    this.eventService.getAll({
      eventType: EventType.ASSAIG,
      timeFilter: 'upcoming',
      sortBy: 'date',
      sortOrder: 'ASC',
      limit: 1,
      page: 1,
    }).subscribe({
      next: (res) => {
        this.nextRehearsal.set(res.data[0] ?? null);
        this.totalRehearsals.set(res.meta.total);
      },
    });

    // Next performance
    this.eventService.getAll({
      eventType: EventType.ACTUACIO,
      timeFilter: 'upcoming',
      sortBy: 'date',
      sortOrder: 'ASC',
      limit: 1,
      page: 1,
    }).subscribe({
      next: (res) => {
        this.nextPerformance.set(res.data[0] ?? null);
        this.totalPerformances.set(res.meta.total);
      },
    });

    // Total persons
    this.personService.getAll({ limit: 1, page: 1, isActive: true }).subscribe({
      next: (res) => {
        this.totalPersons.set(res.meta.total);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('ca-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  formatTime(timeStr: string | null): string {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  }
}
