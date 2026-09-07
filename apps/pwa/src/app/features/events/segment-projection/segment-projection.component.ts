import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  Injector,
  OnInit,
  OnDestroy,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft, ChevronLeft, ChevronRight, Search } from 'lucide-angular';
import { computeSegmentDisplayName, matchesSearch } from '@muixer/shared';
import { AssignmentPersonDetail, ProjectionSegmentData, PinyaProjectionComponent } from '@muixer/pinyes-render';
import { ModalComponent } from '@muixer/ui';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { ProjectionService } from '../services/projection.service';
import { LayoutService } from '../../../core/services/layout.service';
import { AuthService } from '../../../core/auth/services/auth.service';

@Component({
  selector: 'app-segment-projection',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, PinyaProjectionComponent, EmptyStateComponent, ModalComponent],
  templateUrl: './segment-projection.component.html',
})
export class SegmentProjectionComponent implements OnInit, OnDestroy {
  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();

  protected readonly ArrowLeft = ArrowLeft;
  protected readonly ChevronLeft = ChevronLeft;
  protected readonly ChevronRight = ChevronRight;
  protected readonly Search = Search;

  private readonly router = inject(Router);
  private readonly projectionService = inject(ProjectionService);
  private readonly layoutService = inject(LayoutService);
  private readonly authService = inject(AuthService);
  private readonly injector = inject(Injector);

  /** The rendered `lib-pinya-projection` — used to re-trigger its flight animation whenever the
   *  looked-up person changes (see `flyToHighlighted`), same way its own Troba'm button does. */
  private readonly projection = viewChild<{ onTroba(): void }>('projection');
  /** The picker's filter box — autofocused via `focusFilterInput` whenever the picker opens. */
  private readonly filterInputRef = viewChild<ElementRef<HTMLInputElement>>('filterInput');

  /** The viewer's own linked Person, if any — enables the "you are here" banner. */
  private readonly ownPersonId = computed(() => this.authService.currentUser()?.person?.id ?? null);

  /** Set while looking up someone else via the person-search picker; `null` means "the caller". */
  protected readonly selectedParticipant = signal<AssignmentPersonDetail | null>(null);

  /** Fed to `lib-pinya-projection` — the looked-up person's id, or the caller's own. */
  protected readonly highlightPersonId = computed(() => this.selectedParticipant()?.id ?? this.ownPersonId());
  /** Fed to `lib-pinya-projection` — non-null only while looking up someone else. */
  protected readonly highlightPersonName = computed(() => this.selectedParticipant()?.alias ?? null);

  protected readonly pickerOpen = signal(false);
  protected readonly filterText = signal('');

  /** Every distinct person placed anywhere in this segment — the picker's search space. A person
   *  not in this list has no position to show, so there is nothing useful to look them up for. */
  protected readonly participants = computed((): AssignmentPersonDetail[] => {
    const data = this.data();
    if (!data) return [];
    const byId = new Map<string, AssignmentPersonDetail>();
    for (const instance of data.instances) {
      for (const assignment of instance.assignments) {
        if (!byId.has(assignment.person.id)) byId.set(assignment.person.id, assignment.person);
      }
    }
    return [...byId.values()];
  });

  protected readonly filteredParticipants = computed((): AssignmentPersonDetail[] => {
    const query = this.filterText();
    return this.participants().filter(
      (p) => matchesSearch(p.alias, query) || matchesSearch(p.name, query) || matchesSearch(p.firstSurname, query),
    );
  });

  ngOnInit(): void {
    this.layoutService.requestFullscreen();
  }

  ngOnDestroy(): void {
    this.layoutService.exitFullscreen();
  }

  protected readonly projectionResource = rxResource<
    ProjectionSegmentData,
    { eventId: string; segmentId: string }
  >({
    params: () => ({ eventId: this.eventId(), segmentId: this.segmentId() }),
    stream: ({ params }) => this.projectionService.getProjection(params.eventId, params.segmentId),
  });

  protected readonly data = computed((): ProjectionSegmentData | undefined =>
    this.projectionResource.error() ? undefined : this.projectionResource.value(),
  );
  protected readonly isLoading = this.projectionResource.isLoading;
  protected readonly hasError = computed(() => !!this.projectionResource.error());

  protected readonly segmentLabel = computed(() => {
    const data = this.data();
    if (!data) return '';
    return computeSegmentDisplayName(data.segment.name, data.instances);
  });

  goBack(): void {
    this.router.navigate(['/events', this.eventId()]);
  }

  navigateSegment(direction: 'prev' | 'next'): void {
    const data = this.data();
    if (!data) return;
    const targetId = direction === 'prev' ? data.segment.prevSegmentId : data.segment.nextSegmentId;
    if (!targetId) return;
    // replaceUrl so prev/next never grows the history stack — the browser back button always
    // returns straight to the event screen, no matter how many segments were browsed in between.
    this.router.navigate(['/events', this.eventId(), 'segments', targetId], { replaceUrl: true });
  }

  openPicker(): void {
    this.pickerOpen.set(true);
    // The filter box only enters the DOM once `pickerOpen()` flips true (it's behind an `@if`),
    // so it can't be focused synchronously here — `afterNextRender` runs once the upcoming
    // render (this one) has committed, by which point the input exists and `lib-modal`'s own
    // `showModal()` (which steals focus to the dialog itself) has already run.
    afterNextRender(() => this.filterInputRef()?.nativeElement.focus(), { injector: this.injector });
  }

  closePicker(): void {
    this.pickerOpen.set(false);
    this.filterText.set('');
  }

  selectParticipant(person: AssignmentPersonDetail): void {
    // Picking yourself out of the list isn't "looking someone up" — it's still "me". Route it
    // through the same state as the back-to-me button, so the banner reads "Sou…" with no
    // Troba'm-relabel/back-to-me button, exactly as if nobody had been searched for at all.
    this.selectedParticipant.set(person.id === this.ownPersonId() ? null : person);
    this.closePicker();
    this.flyToHighlighted();
  }

  /** The projection's back-to-me button (see `PinyaProjectionComponent.backToSelf`). */
  onBackToSelf(): void {
    this.selectedParticipant.set(null);
    this.flyToHighlighted();
  }

  /** Re-triggers the projection's flight animation to whichever placement `highlightPersonId`
   *  now resolves to — the same effect as tapping its own Troba'm/On està button. Deferred to
   *  `afterNextRender` because `lib-pinya-projection` derives its flight target from its
   *  `highlightPersonId`/`highlightPersonName` inputs, which only carry the new value once this
   *  change detection pass has committed. */
  private flyToHighlighted(): void {
    afterNextRender(() => this.projection()?.onTroba(), { injector: this.injector });
  }
}
