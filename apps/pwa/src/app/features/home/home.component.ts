import {
  Component,
  ChangeDetectionStrategy,
  inject,
  computed,
  effect,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { AttendanceStatus, MeEvent } from '@muixer/shared';
import { LucideAngularModule, User, CalendarOff } from 'lucide-angular';
import { SkeletonCardComponent } from '../../shared/components/skeleton-card/skeleton-card.component';
import { AlertComponent, ButtonComponent, CardComponent, EmptyStateComponent } from '@muixer/ui';
import { EventCardComponent } from '../events/components/event-card/event-card.component';
import { PullToRefreshComponent } from '../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { AuthService } from '../../core/auth/services/auth.service';
import { DependentsService } from '../../core/services/dependents.service';
import { HomeService } from './services/home.service';
import { markdownExcerpt } from '../../shared/utils/markdown-excerpt.util';

/** How many characters of a news item's body to show in its home-page preview card. */
const NEWS_EXCERPT_LENGTH = 300;

@Component({
  selector: 'app-home',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    AlertComponent,
    ButtonComponent,
    CardComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    EventCardComponent,
    PullToRefreshComponent,
  ],
  templateUrl: './home.component.html',
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly homeService = inject(HomeService);
  private readonly dependentsService = inject(DependentsService);

  protected readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');
  protected readonly UserIcon = User;
  protected readonly CalendarOff = CalendarOff;

  protected readonly homeResource = rxResource({
    stream: () => this.homeService.loadHomeData(),
  });

  protected readonly isLoading = this.homeResource.isLoading;
  protected readonly hasError = computed(() => !!this.homeResource.error());
  protected readonly nextRehearsal = computed(() =>
    this.homeResource.error() ? null : (this.homeResource.value()?.nextRehearsal ?? null),
  );
  protected readonly nextPerformance = computed(() =>
    this.homeResource.error() ? null : (this.homeResource.value()?.nextPerformance ?? null),
  );

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

  protected readonly news = computed(() => {
    const news = this.homeResource.error() ? [] : (this.homeResource.value()?.news ?? []);
    return news.map((item) => ({
      ...item,
      excerpt: markdownExcerpt(item.body, NEWS_EXCERPT_LENGTH),
    }));
  });

  protected readonly pendingDependentsResource = rxResource({
    stream: () => this.dependentsService.getPending(),
  });

  protected readonly pendingDependents = computed(() => this.pendingDependentsResource.value() ?? []);

  constructor() {
    effect(() => {
      if (!this.isLoading()) {
        this.pullToRefresh()?.complete();
      }
    });
  }

  protected reload(): void {
    this.homeResource.reload();
  }

  protected onAttendanceChanged(change: { eventId: string; status: AttendanceStatus }): void {
    this.homeResource.update((current) => {
      if (!current) return current;
      const patch = (ev: MeEvent | null): MeEvent | null => {
        if (!ev || ev.id !== change.eventId) return ev;
        return {
          ...ev,
          myAttendance: {
            id: ev.myAttendance?.id ?? '',
            status: change.status,
            respondedAt: new Date().toISOString(),
          },
        };
      };
      return {
        ...current,
        nextRehearsal: patch(current.nextRehearsal),
        nextPerformance: patch(current.nextPerformance),
      };
    });
  }
}
