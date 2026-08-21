import { Component, ChangeDetectionStrategy, inject, signal, OnInit, computed } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent, CardComponent, EmptyStateComponent } from '@muixer/ui';
import { DOMAIN_ICONS } from '../../shared/constants/domain-icons';
import { EventService } from '../events/services/event.service';
import { AuthService } from '../../core/auth/services/auth.service';
import { EventListItem, EventType } from '../events/models/event.model';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule, ButtonComponent, CardComponent, EmptyStateComponent],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  readonly ICON_ASSAIG = DOMAIN_ICONS.ASSAIG;
  readonly ICON_ACTUACIO = DOMAIN_ICONS.ACTUACIO;

  private readonly eventService = inject(EventService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly displayName = computed(() => {
    const u = this.auth.currentUser();
    if (!u) return null;
    return u.person?.alias || u.person?.name || u.email;
  });

  nextRehearsal = signal<EventListItem | null>(null);
  nextPerformance = signal<EventListItem | null>(null);

  readonly rehearsalLink = computed(() => {
    const event = this.nextRehearsal();
    return event ? ['/events', event.id] : undefined;
  });
  readonly performanceLink = computed(() => {
    const event = this.nextPerformance();
    return event ? ['/events', event.id] : undefined;
  });

  loading = signal(true);

  ngOnInit(): void {
    this.loadData();
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }

  private loadData(): void {
    this.loading.set(true);

    let pending = 2;
    const onSettled = () => {
      if (--pending === 0) this.loading.set(false);
    };

    // Next rehearsal
    this.eventService.getAll({
      eventType: EventType.ASSAIG,
      timeFilter: 'upcoming',
      sortBy: 'date',
      sortOrder: 'ASC',
      limit: 1,
      page: 1,
    }).subscribe({
      next: (res) => this.nextRehearsal.set(res.data[0] ?? null),
      complete: onSettled,
      error: onSettled,
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
      next: (res) => this.nextPerformance.set(res.data[0] ?? null),
      complete: onSettled,
      error: onSettled,
    });
  }

  formatDate(dateStr: string): string {
    // ca-ES returns an all-lowercase string ("dimecres, 15 de juliol de 2026").
    // Capitalize only the first letter — a CSS `capitalize` would wrongly
    // Title-Case every word ("Dimecres, 15 De Juliol De 2026").
    const formatted = new Date(dateStr).toLocaleDateString('ca-ES', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  }

  formatTime(timeStr: string | null): string {
    if (!timeStr) return '';
    return timeStr.slice(0, 5);
  }
}
