import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RefreshCw, ChevronDown, ChevronUp, UserX } from 'lucide-angular';
import { FigureZone } from '@muixer/shared';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { AvailablePerson, AssignmentDetail, HeightMode, PersonHoverInfo, isConfirmedAttendance } from '../../models/assignment.model';
import { SHOULDER_HEIGHT_BASELINE_CM } from '../../../../shared/utils/person.util';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { formatNodeCordonLabel } from '../../utils/node-cordon-label.util';
import { PersonHoverCardComponent } from '../person-hover-card/person-hover-card.component';
import { TagService } from '../../../config/services/tag.service';
import { TagWithCount } from '../../../config/models/tag.model';

interface PersonSearchResult {
  person: AvailablePerson;
  /** True when the person is currently assigned to a (different) node in this segment. */
  isAssigned: boolean;
}

@Component({
  selector: 'app-person-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, PersonHoverCardComponent],
  templateUrl: './person-panel.component.html',
})
export class PersonPanelComponent {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('heightInput') heightInputRef?: ElementRef<HTMLInputElement>;

  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');
  readonly activeNodePositionType = input<string | null>(null);
  readonly selectedNodeZone = input<string | null>(null);
  readonly isPast = input<boolean>(false);

  readonly personSelected = output<AvailablePerson>();
  readonly assignedPersonSelected = output<{ personId: string; instanceId: string }>();
  readonly unassignRequested = output<AssignmentDetail>();

  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly state = inject(AssignmentStateService);
  private readonly tagService = inject(TagService);

  readonly RefreshCw = RefreshCw;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly UserX = UserX;
  readonly ICON_OBSERVACIONS = DOMAIN_ICONS.OBSERVACIONS;

  readonly persons = signal<AvailablePerson[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly height = signal<number | null>(null);
  readonly heightSortMode = signal<'max' | 'min' | null>(null);
  readonly showXicalla = signal(false);
  readonly tags = signal<TagWithCount[]>([]);
  readonly selectedPositionId = signal<string | null>(null);
  readonly tagFilterOpen = signal(false);
  readonly tagSearch = signal('');

  readonly selectedTag = computed(() =>
    this.tags().find((t) => t.id === this.selectedPositionId()) ?? null,
  );

  readonly filteredTags = computed(() => {
    const term = this.normalizeForMatch(this.tagSearch());
    if (!term) return this.tags();
    return this.tags().filter((t) => this.normalizeForMatch(t.name).includes(term));
  });
  readonly altresExpanded = signal(false);
  readonly assignadesExpanded = signal(true);
  readonly hoveredPerson = signal<{ info: PersonHoverInfo; top: number; left: number } | null>(null);
  readonly highlightedIndex = signal(0);
  private hasTypedSinceNodeSelected = false;

  readonly selectedAssignment = computed(() => {
    const nodeId = this.selectedNodeId();
    if (!nodeId) return null;
    return this.assignments().find((a) => a.node.id === nodeId) ?? null;
  });

  /** Person picked to be assigned to the next node click — drives the row highlight below. */
  readonly selectedPersonId = computed(() => this.state.selectedPersonId());

  /** True while a height filter or Max/Min sort is active — used to exclude persons with no shoulder height set. */
  readonly heightSelectionActive = computed(() => this.height() !== null || this.heightSortMode() !== null);

  assignedBadgeLabel(person: AvailablePerson): string {
    if (!person.assignedNodeLabel) return 'Assignada';
    return formatNodeCordonLabel(person.assignedNodeLabel, person.assignedNodeCordon);
  }

  readonly freePersons = computed(() => {
    const free = this.persons().filter((p) => !p.assignedInSegment);
    if (!this.heightSelectionActive()) return free;
    // A shoulderHeight of null/0 means "not set" — coalesced to 0 server-side, which would
    // otherwise sort these persons as the shortest possible match when ordering by min height.
    return free.filter((p) => p.shoulderHeight !== null && p.shoulderHeight !== 0);
  });

  readonly confirmedPersons = computed(() =>
    this.isPast()
      ? this.freePersons().filter((p) => p.attendanceStatus === 'ASSISTIT')
      : this.freePersons().filter((p) => isConfirmedAttendance(p.attendanceStatus)),
  );

  private sortByPosition(persons: AvailablePerson[]): AvailablePerson[] {
    const posType = this.activeNodePositionType();
    if (!posType) return persons;
    return [...persons].sort((a, b) => {
      const aMatch = a.positions.some((p) => (p.positionTypes ?? []).includes(posType)) ? 1 : 0;
      const bMatch = b.positions.some((p) => (p.positionTypes ?? []).includes(posType)) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  readonly sortedConfirmedPersons = computed(() =>
    this.sortByPosition(this.confirmedPersons()),
  );

  readonly noShowPersons = computed(() =>
    this.isPast()
      ? this.freePersons().filter((p) => p.attendanceStatus === 'ANIRE')
      : [],
  );

  readonly sortedNoShowPersons = computed(() =>
    this.sortByPosition(this.noShowPersons()),
  );

  readonly pendingPersons = computed(() =>
    this.isPast()
      ? []
      : this.freePersons().filter((p) => p.attendanceStatus === 'PENDENT'),
  );

  readonly declinedPersons = computed(() =>
    this.isPast()
      ? this.freePersons().filter((p) => p.attendanceStatus === 'NO_VAIG' || p.attendanceStatus === 'PENDENT')
      : this.freePersons().filter((p) => p.attendanceStatus === 'NO_VAIG'),
  );

  readonly assignedPersons = computed(() => {
    const apiAssigned = this.persons().filter((p) => p.assignedInSegment);
    const seen = new Set(apiAssigned.map((p) => p.id));
    const extras: AvailablePerson[] = [];

    // Supplement with current-instance assignments (optimistic / before API refresh)
    for (const assignment of this.assignments()) {
      if (seen.has(assignment.person.id)) continue;
      const fromList = this.persons().find((p) => p.id === assignment.person.id);
      extras.push({
        ...(fromList ?? {
          id: assignment.person.id,
          alias: assignment.person.alias,
          name: assignment.person.name,
          firstSurname: assignment.person.firstSurname,
          shoulderHeight: assignment.person.shoulderHeight,
          notes: assignment.person.notes,
          notesEmoji: assignment.person.notesEmoji,
          isXicalla: false,
          attendanceStatus: 'ANIRE',
          nextPerformanceStatus: null,
          assignedInSegment: true,
          positions: [],
        }),
        assignedInSegment: true,
        assignedInstanceId: assignment.figureInstanceId,
        assignedNodeLabel: assignment.node.label,
        assignedNodeCordon: assignment.node.renglaPosition ?? null,
      });
      seen.add(assignment.person.id);
    }

    const positionId = this.selectedPositionId();
    const combined = [...apiAssigned, ...extras];
    if (!positionId) return combined;
    return combined.filter((p) => p.positions.some((pos) => pos.id === positionId));
  });

  /**
   * Up to 5 ranked matches for the typed search term. Group 1 (exact alias match) wins
   * regardless of status; groups 2-5 apply the same match-type ordering (alias prefix >
   * name prefix > alias substring > name substring) within each attendance/assignment bucket.
   */
  readonly searchResults = computed<PersonSearchResult[]>(() => {
    const term = this.normalizeForMatch(this.search());
    if (!term) return [];

    const results: PersonSearchResult[] = [];
    const seen = new Set<string>();

    const exact = this.persons().find((p) => this.normalizeForMatch(p.alias) === term);
    if (exact) {
      results.push({ person: exact, isAssigned: exact.assignedInSegment });
      seen.add(exact.id);
    }

    const pushGroup = (persons: AvailablePerson[], isAssigned: boolean) => {
      for (const person of this.rankByMatchType(persons, term, seen)) {
        if (results.length >= 5) return;
        results.push({ person, isAssigned });
        seen.add(person.id);
      }
    };

    pushGroup([...this.confirmedPersons(), ...this.noShowPersons()], false);
    pushGroup(this.assignedPersons(), true);
    pushGroup(this.pendingPersons(), false);
    pushGroup(this.declinedPersons(), false);

    return results.slice(0, 5);
  });

  readonly effectiveHighlightedIndex = computed(() => {
    const total = this.searchResults().length;
    if (total === 0) return 0;
    return Math.min(this.highlightedIndex(), total - 1);
  });

  /** alias-prefix > name-prefix > alias-substring > name-substring; no fuzzy fallback. */
  private matchType(person: AvailablePerson, term: string): number | null {
    const alias = this.normalizeForMatch(person.alias);
    const name = this.normalizeForMatch(person.name);
    if (alias.startsWith(term)) return 0;
    if (name.startsWith(term)) return 1;
    if (alias.includes(term)) return 2;
    if (name.includes(term)) return 3;
    return null;
  }

  private rankByMatchType(persons: AvailablePerson[], term: string, exclude: Set<string>): AvailablePerson[] {
    return persons
      .filter((p) => !exclude.has(p.id))
      .map((p) => ({ person: p, rank: this.matchType(p, term) }))
      .filter((entry): entry is { person: AvailablePerson; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.person.alias.localeCompare(b.person.alias))
      .map((entry) => entry.person);
  }

  constructor() {
    this.tagService.getAll().subscribe((tags) => this.tags.set(tags));

    effect((onCleanup) => {
      const nodeId = this.selectedNodeId();
      if (nodeId !== null) {
        this.hasTypedSinceNodeSelected = false;
        const focusTimer = setTimeout(() => {
          if (document.activeElement === this.heightInputRef?.nativeElement) return;
          this.focusSearch();
        }, 0);
        onCleanup(() => clearTimeout(focusTimer));
        // Auto-toggle the Xicalla filter to match the selected node's zone.
        // Left untouched when a node is deselected (nodeId === null).
        // Goes through onXicallaChange (not a direct signal set) so the person
        // list is actually re-fetched with the new filter, same as a manual toggle.
        this.onXicallaChange(this.selectedNodeZone() === FigureZone.TRONC);
      }
    });

    effect(() => {
      this.state.personListRefreshTrigger();
      untracked(() => {
        if (this.eventId() && this.segmentId()) {
          this.loadPersons();
          this.loadRegistries();
        }
      });
    });
  }

  focusSearch(): void {
    this.searchInputRef?.nativeElement.focus();
  }

  /**
   * Full roster (all statuses, including xicalla) regardless of the visible list's filters.
   * Feeds state.confirmedPersons + attendance registries, which back hover cards for already-
   * assigned persons anywhere in the canvas — those must resolve even when "Xicalla" is unchecked.
   */
  private loadRegistries(): void {
    this.assignmentService
      .getAvailablePersons(this.eventId(), this.segmentId(), { excludeAssigned: false })
      .subscribe((resp) => {
        this.state.confirmedPersons.set(resp.data);
        this.state.attendanceRegistry.update((m) => {
          const updated = new Map(m);
          resp.data.forEach((p) => updated.set(p.id, p.attendanceStatus));
          return updated;
        });
        this.state.nextPerformanceRegistry.update((m) => {
          const updated = new Map(m);
          resp.data.forEach((p) => updated.set(p.id, p.nextPerformanceStatus ?? null));
          return updated;
        });
      });
  }

  loadPersons(): void {
    this.loading.set(true);
    const query: Record<string, any> = {
      excludeAssigned: false,
    };
    const sortMode = this.heightSortMode();
    if (sortMode !== null) {
      const heightValue = sortMode === 'max' ? 1000 : -1000;
      query['height'] = this.heightMode() === 'relative' ? SHOULDER_HEIGHT_BASELINE_CM + heightValue : heightValue;
    } else if (this.height() !== null) {
      const heightValue = this.height()!;
      const absoluteHeight = this.heightMode() === 'relative' ? SHOULDER_HEIGHT_BASELINE_CM + heightValue : heightValue;
      query['height'] = absoluteHeight;
    }
    if (!this.showXicalla()) query['isXicalla'] = false;
    if (this.selectedPositionId()) query['positionId'] = this.selectedPositionId();

    this.assignmentService
      .getAvailablePersons(this.eventId(), this.segmentId(), query)
      .subscribe({
        next: (resp) => {
          this.persons.set(resp.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearchChange(value: string): void {
    if (value.length > 0) {
      this.hasTypedSinceNodeSelected = true;
    }
    this.search.set(value);
    this.highlightedIndex.set(0);
  }

  onHeightChange(value: number | null): void {
    this.heightSortMode.set(null);
    this.height.set(value);
    this.loadPersons();
  }

  toggleHeightSort(mode: 'max' | 'min'): void {
    this.height.set(null);
    this.heightSortMode.set(this.heightSortMode() === mode ? null : mode);
    this.loadPersons();
  }

  onXicallaChange(checked: boolean): void {
    this.showXicalla.set(checked);
    this.loadPersons();
  }

  onPositionFilterChange(positionId: string): void {
    this.selectedPositionId.set(positionId || null);
    this.tagFilterOpen.set(false);
    this.tagSearch.set('');
    this.loadPersons();
  }

  clearTagFilter(): void {
    this.onPositionFilterChange('');
  }

  toggleTagFilter(): void {
    this.tagFilterOpen.update((v) => !v);
  }

  onTagSearchChange(value: string): void {
    this.tagSearch.set(value);
  }

  /** Fallback used when Enter is pressed with an empty search box. */
  private selectFirstFreePerson(): void {
    const first =
      this.sortedConfirmedPersons()[0] ??
      this.pendingPersons()[0] ??
      this.declinedPersons()[0];
    if (first) this.selectPerson(first);
  }

  private normalizeForMatch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  requestUnassign(): void {
    const assignment = this.selectedAssignment();
    if (!assignment) return;
    this.unassignRequested.emit(assignment);
  }

  onSearchKeyDown(event: KeyboardEvent): void {
    const resultsCount = this.searchResults().length;

    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      if (resultsCount > 0) {
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.min(i + 1, resultsCount - 1));
      }
      return;
    }
    if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      if (resultsCount > 0) {
        event.preventDefault();
        this.highlightedIndex.update((i) => Math.max(i - 1, 0));
      }
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.search().trim() === '') {
        this.selectFirstFreePerson();
        return;
      }
      const results = this.searchResults();
      if (results.length > 0) {
        this.selectSearchResult(results[this.effectiveHighlightedIndex()]);
      }
      return;
    }
    if (event.key === 'Backspace') {
      const input = event.target as HTMLInputElement;
      if (input.value === '' && !this.hasTypedSinceNodeSelected) {
        const assignment = this.selectedAssignment();
        if (assignment) {
          event.preventDefault();
          this.requestUnassign();
        }
      }
    }
  }

  selectPerson(person: AvailablePerson): void {
    this.personSelected.emit(person);
    this.clearSearch();
  }

  selectSearchResult(result: PersonSearchResult): void {
    if (result.isAssigned && result.person.assignedInstanceId) {
      this.assignedPersonSelected.emit({
        personId: result.person.id,
        instanceId: result.person.assignedInstanceId,
      });
      this.clearSearch();
      return;
    }
    this.selectPerson(result.person);
  }

  private clearSearch(): void {
    this.search.set('');
    this.highlightedIndex.set(0);
  }

  toHoverInfo(person: AvailablePerson): PersonHoverInfo {
    return {
      alias: person.alias,
      attendanceStatus: person.attendanceStatus,
      isXicalla: person.isXicalla,
      shoulderHeight: person.shoulderHeight,
      notes: person.notes,
      notesEmoji: person.notesEmoji,
      positions: person.positions,
    };
  }

  onPersonHover(event: MouseEvent, person: AvailablePerson): void {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.hoveredPerson.set({
      info: this.toHoverInfo(person),
      top: rect.top,
      left: rect.left,
    });
  }

  onPersonLeave(): void {
    this.hoveredPerson.set(null);
  }

  navigateToAssigned(person: AvailablePerson): void {
    if (person.assignedInstanceId) {
      this.assignedPersonSelected.emit({
        personId: person.id,
        instanceId: person.assignedInstanceId,
      });
    }
  }

  formatHeight(person: AvailablePerson): string {
    if (person.shoulderHeight === null || person.shoulderHeight === 0) return '-';
    const h = person.shoulderHeight;
    if (this.heightMode() === 'relative') {
      const diff = h - SHOULDER_HEIGHT_BASELINE_CM;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  }

  toggleAltres(): void {
    this.altresExpanded.update((v) => !v);
  }
}
