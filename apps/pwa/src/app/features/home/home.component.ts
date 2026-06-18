import {
  Component,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
  OnInit,
} from '@angular/core';
import { MeEvent } from '@muixer/shared';
import { MobileHeaderComponent } from '../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { EventCardComponent } from '../events/components/event-card/event-card.component';
import { AuthService } from '../../core/auth/services/auth.service';
import { HomeService } from './services/home.service';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    EventCardComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly homeService = inject(HomeService);

  protected readonly isLoading = signal(true);
  protected readonly nextRehearsals = signal<MeEvent[]>([]);
  protected readonly nextPerformances = signal<MeEvent[]>([]);

  protected readonly greeting = computed(() => {
    const person = this.auth.currentUser()?.person;
    const name = person?.alias || person?.name || '';
    return name ? `Hola, ${name}!` : 'Hola!';
  });

  protected readonly hasEvents = computed(
    () => this.nextRehearsals().length > 0 || this.nextPerformances().length > 0,
  );

  ngOnInit(): void {
    this.homeService.loadHomeData().subscribe({
      next: (data) => {
        this.nextRehearsals.set(data.nextRehearsals);
        this.nextPerformances.set(data.nextPerformances);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }
}
