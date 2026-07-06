import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  inject,
  signal,
  computed,
  OnInit,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MeEvent } from '@muixer/shared';
import { LucideAngularModule, User } from 'lucide-angular';
import { MobileHeaderComponent } from '../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../shared/components/empty-state/empty-state.component';
import { EventCardComponent } from '../events/components/event-card/event-card.component';
import { PullToRefreshComponent } from '../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { AuthService } from '../../core/auth/services/auth.service';
import { HomeService } from './services/home.service';

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    EventCardComponent,
    PullToRefreshComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly homeService = inject(HomeService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');
  protected readonly UserIcon = User;

  protected readonly isLoading = signal(true);
  protected readonly nextRehearsal = signal<MeEvent | null>(null);
  protected readonly nextPerformance = signal<MeEvent | null>(null);

  protected readonly greeting = computed(() => {
    const person = this.auth.currentUser()?.person;
    const name = person?.alias || person?.name || '';
    return name ? `Hola, ${name}!` : 'Hola!';
  });

  protected readonly avatarInitial = computed(() => {
    const person = this.auth.currentUser()?.person;
    const name = person?.alias || person?.name || '';
    return name ? name.charAt(0).toUpperCase() : null;
  });

  protected readonly hasEvents = computed(
    () => this.nextRehearsal() !== null || this.nextPerformance() !== null,
  );

  ngOnInit(): void {
    this.loadData();
  }

  protected reload(): void {
    this.loadData();
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.homeService.loadHomeData().pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (data) => {
        this.nextRehearsal.set(data.nextRehearsal);
        this.nextPerformance.set(data.nextPerformance);
        this.isLoading.set(false);
        this.pullToRefresh()?.complete();
      },
      error: () => {
        this.isLoading.set(false);
        this.pullToRefresh()?.complete();
      },
    });
  }
}
