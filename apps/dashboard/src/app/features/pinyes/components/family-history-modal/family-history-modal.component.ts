import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  computed,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { SeasonService } from '../../../events/services/season.service';
import { FigureHistoryEntry } from '../../models/assignment.model';
import { Season } from '../../../events/models/event.model';
import { EmptyStateComponent } from '../../../../shared/components/data/empty-state/empty-state.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';

@Component({
  selector: 'app-family-history-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, EmptyStateComponent, PaginationComponent, CdkTrapFocus],
  templateUrl: './family-history-modal.component.html',
})
export class FamilyHistoryModalComponent {
  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly seasonService = inject(SeasonService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  familyId = input.required<string>();
  familyName = input<string>('');
  closed = output<void>();

  entries = signal<FigureHistoryEntry[]>([]);
  loading = signal(false);
  total = signal(0);
  page = signal(1);
  limit = signal(20);
  seasonId = signal<string | undefined>(undefined);
  seasons = signal<Season[]>([]);
  totalPages = computed(() => Math.ceil(this.total() / this.limit()));

  constructor() {
    this.seasonService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (res) => this.seasons.set(res.data),
    });
    effect(() => {
      this.familyId(); // track familyId changes
      untracked(() => this.loadHistory());
    });
  }

  loadHistory() {
    this.loading.set(true);
    this.nodeAssignmentService
      .getFamilyHistory(this.familyId(), {
        page: this.page(),
        limit: this.limit(),
        seasonId: this.seasonId(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.entries.set(res.data);
          this.total.set(res.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onPageChange(page: number) {
    this.page.set(page);
    this.loadHistory();
  }

  onSeasonChange(seasonId: string) {
    this.seasonId.set(seasonId || undefined);
    this.page.set(1);
    this.loadHistory();
  }

  navigateToEvent(entry: FigureHistoryEntry) {
    const base = entry.eventType === 'ACTUACIO' ? '/performances' : '/rehearsals';
    this.router.navigate([base, entry.eventId]);
    this.closed.emit();
  }

  close() {
    this.closed.emit();
  }

  formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ca-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  eventTypeLabel(eventType: string): string {
    return eventType === 'ACTUACIO' ? 'Actuació' : 'Assaig';
  }
}
