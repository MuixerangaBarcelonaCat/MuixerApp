import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { ArrowDown, ArrowUp, Columns3, LucideAngularModule, TriangleAlert } from 'lucide-angular';
import { AlertComponent, ButtonComponent, CheckboxComponent, DOMAIN_ICONS, ModalComponent } from '@muixer/ui';
import { injectPinyesRenderSettings } from '@muixer/pinyes-render/settings';
import { ParticipationService } from '../../../events/services/participation.service';
import { EventParticipation } from '../../../events/models/participation.model';
import { TagService } from '../../../config/services/tag.service';
import { TagWithCount } from '../../../config/models/tag.model';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { QuadreColumnsService } from '../../services/quadre-columns.service';
import {
  QuadreEntry,
  QuadreRowState,
  buildQuadre,
  formatShoulderHeight,
  participationDots,
} from '../../utils/quadre-troncs.util';

/** Static map — never build Tailwind classes from template literals. */
const ROW_CLASSES: Record<QuadreRowState, string> = {
  both: 'bg-success/15',
  notPerformance: 'bg-error/15',
  unanswered: '',
  neutral: '',
  performanceOnly: 'opacity-50',
  assignedAbsent: 'bg-warning/20',
};
const HIGHLIGHT_CLASS = 'ring-2 ring-inset ring-primary';

/**
 * «Quadre de persones»: read-only, near-fullscreen view of who is coming to the event,
 * by tag column and height, with attendance to the next performance and participation dots.
 * Mounted on open (`@if`), so every open fetches fresh data — technicians work in parallel.
 */
@Component({
  selector: 'app-quadre-troncs-modal',
  standalone: true,
  imports: [FormsModule, LucideAngularModule, ModalComponent, AlertComponent, ButtonComponent, CheckboxComponent],
  templateUrl: './quadre-troncs-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuadreTroncsModalComponent implements OnInit {
  private readonly participationService = inject(ParticipationService);
  private readonly tagService = inject(TagService);
  private readonly columnsService = inject(QuadreColumnsService);
  private readonly assignmentState = inject(AssignmentStateService);
  private readonly renderSettings = injectPinyesRenderSettings();
  private readonly destroyRef = inject(DestroyRef);

  readonly eventId = input.required<string>();
  readonly closed = output<void>();

  protected readonly ICON_ACTUACIO = DOMAIN_ICONS.ACTUACIO;
  protected readonly TriangleAlert = TriangleAlert;
  protected readonly Columns3 = Columns3;
  protected readonly ArrowUp = ArrowUp;
  protected readonly ArrowDown = ArrowDown;

  private readonly data = signal<EventParticipation | null>(null);
  protected readonly tags = signal<TagWithCount[]>([]);
  protected readonly error = signal(false);
  /** Ids of the tags shown as columns, in order. */
  protected readonly columnIds = signal<string[]>([]);
  protected readonly columnsPanelOpen = signal(false);
  readonly onlyUnplaced = signal(false);
  protected readonly hoveredPersonId = signal<string | null>(null);

  protected readonly title = computed(() => {
    const event = this.data()?.event;
    return event ? `Quadre de persones — ${event.title}` : 'Quadre de persones';
  });

  protected readonly quadre = computed(() => {
    const data = this.data();
    if (!data) return null;
    const byId = new Map(this.tags().map((t) => [t.id, t]));
    const columns = this.columnIds()
      .map((id) => byId.get(id))
      .filter((t): t is TagWithCount => !!t)
      .map(({ id, name }) => ({ id, name }));
    return buildQuadre(data.persons, columns);
  });

  ngOnInit(): void {
    forkJoin([
      this.participationService.getByEvent(this.eventId(), { includeNextPerformance: true }),
      this.tagService.getAll(),
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([data, tags]) => {
          this.tags.set(tags);
          this.columnIds.set(this.columnsService.resolve(tags).map((c) => c.id));
          this.data.set(data);
        },
        error: () => this.error.set(true),
      });
  }

  protected visibleEntries(entries: QuadreEntry[]): QuadreEntry[] {
    return this.onlyUnplaced() ? entries.filter((e) => e.figureCount === 0) : entries;
  }

  protected rowClass(entry: QuadreEntry): string {
    const base = ROW_CLASSES[entry.state];
    return this.hoveredPersonId() === entry.person.id ? `${base} ${HIGHLIGHT_CLASS}` : base;
  }

  protected height(entry: QuadreEntry): string {
    return formatShoulderHeight(
      entry.person.shoulderHeight,
      this.assignmentState.heightMode(),
      this.renderSettings().shoulderHeightBaselineCm,
    );
  }

  protected dots(entry: QuadreEntry): string {
    return participationDots(entry.figureCount);
  }

  protected isShown(tagId: string): boolean {
    return this.columnIds().includes(tagId);
  }

  protected toggleColumn(tagId: string): void {
    const ids = this.columnIds();
    // The last column can't be unticked: an empty choice would read back as «use the defaults».
    if (ids.includes(tagId) && ids.length === 1) return;
    this.setColumns(ids.includes(tagId) ? ids.filter((id) => id !== tagId) : [...ids, tagId]);
  }

  protected moveColumn(index: number, delta: -1 | 1): void {
    const ids = [...this.columnIds()];
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.setColumns(ids);
  }

  protected resetColumns(): void {
    this.columnsService.reset();
    this.columnIds.set(this.columnsService.resolve(this.tags()).map((c) => c.id));
  }

  protected tagName(id: string): string {
    return this.tags().find((t) => t.id === id)?.name ?? '';
  }

  private setColumns(ids: string[]): void {
    this.columnIds.set(ids);
    this.columnsService.save(ids);
  }
}
