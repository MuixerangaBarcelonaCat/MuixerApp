import { AttendanceStatus, AvailablePersonPosition } from '@muixer/pinyes-render';
import {
  Component,
  ChangeDetectionStrategy,
  computed,
  inject,
  input,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search } from 'lucide-angular';
import { ButtonComponent, EmptyStateComponent, InputComponent, SelectComponent } from '@muixer/ui';
import { DataTableComponent, RowAction } from '../../../../shared/components/data/data-table/data-table.component';
import { FilterBarComponent } from '../../../../shared/components/data/filter-bar/filter-bar.component';
import { ActiveFiltersComponent, ActiveFilter } from '../../../../shared/components/data/active-filters/active-filters.component';
import { ColumnToggleComponent } from '../../../../shared/components/data/column-toggle/column-toggle.component';
import { PaginationComponent } from '../../../../shared/components/data/pagination/pagination.component';
import { ColumnDef, ColumnPill } from '../../../../shared/models/column-def.model';
import { SortChange, SortOrder } from '../../../../shared/models/sort.model';
import { ICON_FIGURA, ICON_XICALLA, DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';
import { formatNodeCordonLabel } from '../../../pinyes/utils/node-cordon-label.util';
import { ParticipationService } from '../../services/participation.service';
import {
  ParticipationMeta,
  ParticipationPerson,
  ParticipationPlacement,
  ParticipationSegment,
} from '../../models/participation.model';
import { eventReturnUrl } from '../../utils/event-return-url.util';

/** A row of the matrix. Same shape as the API person — placements are already keyed by segment. */
export type ParticipationRow = ParticipationPerson;

type SortField = 'alias' | 'status' | 'placements' | 'troncPlacements' | 'segmentPercent';

/** Static class maps — never build Tailwind classes from template literals. */
const PILL_POSITION = 'text-base-content';
const PILL_FIGURE = 'text-base-content/50 font-normal';
const PILL_EMPTY = 'text-base-content/20';
const PILL_CONFLICT = 'text-error font-bold';

/** Marks a person placed twice in one segment. Distinct from the observations glyph. */
const CONFLICT_GLYPH = '‼';

const ZONE_LABELS: Record<string, string> = {
  BASE: 'Base',
  PINYA: 'Pinya',
  TRONC: 'Tronc',
  FIGURE_DIRECTION: 'Direcció',
  XICALLA_DIRECTION: 'Direcció xicalla',
  DECORATION: 'Decoració',
};

const EMPTY_META: ParticipationMeta = {
  distinctPersons: 0,
  personsWithPlacement: 0,
  totalPlacements: 0,
  conflictedPersons: 0,
  conflictsByKind: { TRONC_TRONC: 0, TRONC_PINYA: 0, PINYA_PINYA: 0 },
  troncPlacements: 0,
};

type AreaFilter = 'TRONC' | 'PINYA' | null;

/**
 * Person x segment participation matrix for one event: what each member does, across
 * every segment, searchable both by person and by what they do.
 *
 * Two deliberately opposite signalling rules live here:
 * - Having nothing to do in a segment is NOT flagged. Being in the pinya is participating,
 *   and an empty cell is often just "not planned yet".
 * - Being placed twice in the SAME segment IS flagged, at three levels (header counter,
 *   row glyph on the sticky column, cell styling): one person cannot be in two places
 *   at once, so it is always actionable.
 */
@Component({
  selector: 'app-event-participation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    InputComponent,
    SelectComponent,
    EmptyStateComponent,
    DataTableComponent,
    FilterBarComponent,
    ActiveFiltersComponent,
    ColumnToggleComponent,
    PaginationComponent,
  ],
  templateUrl: './event-participation.component.html',
})
export class EventParticipationComponent implements OnInit, OnDestroy {
  readonly ICON_FIGURA = ICON_FIGURA;
  readonly ICON_XICALLA = ICON_XICALLA;
  readonly CONFLICT_GLYPH = CONFLICT_GLYPH;
  readonly DOMAIN_ICONS = DOMAIN_ICONS;
  readonly SearchIcon = Search;

  private readonly participationService = inject(ParticipationService);
  private readonly router = inject(Router);

  eventId = input.required<string>();
  isPast = input(false);

  loading = signal(true);
  loadError = signal(false);
  segments = signal<ParticipationSegment[]>([]);
  persons = signal<ParticipationPerson[]>([]);
  meta = signal<ParticipationMeta>(EMPTY_META);

  // Filters — all client-side: the endpoint returns the whole population in one shot
  // and the matrix needs every row to render complete columns.
  search = signal('');
  searchInput = '';
  private searchTimeout: ReturnType<typeof setTimeout> | undefined;
  selectedSegmentId = signal<string | null>(null);
  statusFilter = signal<AttendanceStatus | null>(null);
  positionFilter = signal<AvailablePersonPosition | null>(null);
  onlyConflicts = signal(false);
  /** Filters which placements are PAINTED in each cell; conflicts keep reading the whole set (§4.1). */
  areaFilter = signal<AreaFilter>(null);

  sortBy = signal<SortField>('alias');
  sortOrder = signal<SortOrder | undefined>('ASC');
  visibleKeys = signal<string[]>([]);
  page = signal(1);
  limit = signal(100);

  readonly hasConflicts = computed(() => this.meta().conflictedPersons > 0);

  /** Tags actually present in the population, so the filter needs no extra request. */
  readonly availablePositions = computed<AvailablePersonPosition[]>(() => {
    const byId = new Map<string, AvailablePersonPosition>();
    for (const person of this.persons()) {
      for (const position of person.positions) {
        if (!byId.has(position.id)) byId.set(position.id, position);
      }
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ca'));
  });

  readonly filteredRows = computed<ParticipationRow[]>(() => {
    const status = this.statusFilter();
    const position = this.positionFilter();
    const conflictsOnly = this.onlyConflicts();
    const term = this.normalizeForMatch(this.search());

    let rows = this.persons();
    if (status) rows = rows.filter((r) => r.attendanceStatus === status);
    if (position) rows = rows.filter((r) => r.positions.some((p) => p.id === position.id));
    if (conflictsOnly) rows = rows.filter((r) => r.conflictSegmentIds.length > 0);
    if (term) rows = this.rankByMatch(rows, term);
    return rows;
  });

  /** A search term supplies its own relevance order, so it wins over the column sort. */
  readonly sortedRows = computed<ParticipationRow[]>(() => {
    const rows = this.filteredRows();
    if (this.normalizeForMatch(this.search())) return rows;

    const order = this.sortOrder();
    if (!order) return rows;
    const direction = order === 'ASC' ? 1 : -1;
    const field = this.sortBy();

    return [...rows].sort((a, b) => {
      if (field === 'status') {
        return a.attendanceStatus.localeCompare(b.attendanceStatus) * direction
          || a.alias.localeCompare(b.alias, 'ca');
      }
      if (field === 'placements') {
        return (a.placementCount - b.placementCount) * direction
          || a.alias.localeCompare(b.alias, 'ca');
      }
      if (field === 'troncPlacements') {
        return (a.troncPlacementCount - b.troncPlacementCount) * direction
          || a.alias.localeCompare(b.alias, 'ca');
      }
      if (field === 'segmentPercent') {
        return (this.segmentPercent(a) - this.segmentPercent(b)) * direction
          || a.alias.localeCompare(b.alias, 'ca');
      }
      return a.alias.localeCompare(b.alias, 'ca') * direction;
    });
  });

  readonly totalRows = computed(() => this.sortedRows().length);
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.totalRows() / this.limit())));

  readonly pagedRows = computed<ParticipationRow[]>(() => {
    const start = (this.page() - 1) * this.limit();
    return this.sortedRows().slice(start, start + this.limit());
  });

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const filters: ActiveFilter[] = [];
    if (this.search()) filters.push({ key: 'search', label: `Cerca: ${this.search()}` });

    const segmentId = this.selectedSegmentId();
    if (segmentId) {
      const segment = this.segments().find((s) => s.id === segmentId);
      if (segment) filters.push({ key: 'segment', label: `Segment: ${this.segmentLabel(segment)}` });
    }

    const status = this.statusFilter();
    if (status) filters.push({ key: 'status', label: `Assistència: ${this.statusLabel(status)}` });

    const position = this.positionFilter();
    if (position) filters.push({ key: 'position', label: `Etiqueta: ${position.name}` });

    if (this.onlyConflicts()) filters.push({ key: 'conflicts', label: 'Només conflictes' });

    const area = this.areaFilter();
    if (area) filters.push({ key: 'area', label: `Àrea: ${area === 'TRONC' ? 'Troncs' : 'Pinyes'}` });

    return filters;
  });

  readonly hasActiveFilters = computed(() => this.activeFilters().length > 0);

  /** Neutral head count; the conflict warning is rendered separately. */
  readonly summaryLine = computed(() => {
    const { distinctPersons, personsWithPlacement } = this.meta();
    const people = distinctPersons === 1 ? 'persona' : 'persones';
    return `${distinctPersons} ${people} · ${personsWithPlacement} amb assignació`;
  });

  readonly conflictLine = computed(() => {
    const count = this.meta().conflictedPersons;
    return count === 1
      ? '1 persona en dos llocs alhora'
      : `${count} persones en dos llocs alhora`;
  });

  /**
   * Load stats over the whole population (not `meta`, which only covers placement
   * totals) — mín/mitjana/màx of `placementCount` plus who has nothing at all, so a
   * change to a tronc can be weighed against how the rest of the event is loaded.
   */
  readonly loadLine = computed(() => {
    const persons = this.persons();
    if (persons.length === 0) return null;

    const counts = persons.map((p) => p.placementCount);
    const min = Math.min(...counts);
    const max = Math.max(...counts);
    const mean = counts.reduce((total, c) => total + c, 0) / counts.length;
    const unplaced = persons.length - this.meta().personsWithPlacement;

    return `Càrrega: mín ${min} · mitjana ${mean.toFixed(1)} · màx ${max}`
      + (unplaced > 0 ? ` · ${unplaced} sense cap col·locació` : '');
  });

  readonly columns = computed<ColumnDef<ParticipationRow>[]>(() => {
    const cols: ColumnDef<ParticipationRow>[] = [
      {
        key: 'person',
        label: 'Persona',
        defaultVisible: true,
        primary: true,
        sortField: 'alias',
        value: (r) => this.personLabel(r),
        prefix: (r) => (r.conflictSegmentIds.length > 0 ? { text: CONFLICT_GLYPH, class: 'text-error font-bold' } : null),
      },
      {
        key: 'fullName',
        label: 'Nom',
        defaultVisible: false,
        value: (r) => `${r.name} ${r.firstSurname}`.trim(),
      },
      {
        key: 'status',
        label: 'Assistència',
        defaultVisible: true,
        type: 'badge',
        sortField: 'status',
        value: (r) => this.statusLabel(r.attendanceStatus),
        badgeClass: (r) => this.statusBadgeClass(r.attendanceStatus),
      },
      {
        key: 'tags',
        label: 'Etiquetes',
        defaultVisible: false,
        type: 'colorBadges',
        colorBadges: (r) => r.positions.map((p) => ({ text: p.name, color: p.color ?? '#888' })),
      },
      {
        key: 'placementCount',
        label: 'Col·locacions',
        defaultVisible: false,
        type: 'number',
        sortField: 'placements',
        value: (r) => r.placementCount,
      },
      {
        key: 'troncPlacementCount',
        label: 'Troncs',
        defaultVisible: false,
        type: 'number',
        sortField: 'troncPlacements',
        value: (r) => r.troncPlacementCount,
      },
      {
        key: 'segmentPercent',
        label: '% segments',
        defaultVisible: false,
        type: 'number',
        sortField: 'segmentPercent',
        value: (r) => `${this.segmentPercent(r)}%`,
      },
    ];

    // Consolidates every TRONC/BASE placement across the whole event in one cell, so
    // "en quin tronc està esta persona" never requires switching the area filter or
    // scrolling the matrix (Fase 6). Only in per-event scope: per-segment scope already
    // answers this for the chosen segment via segFigure/segPosition/segZone below.
    if (!this.selectedSegmentId()) {
      cols.push({
        key: 'troncDetail',
        label: 'Tronc',
        defaultVisible: false,
        type: 'pills',
        pills: (r) => this.troncPills(r),
      });
    }

    const segmentId = this.selectedSegmentId();

    // Per-segment scope: three detail columns about the chosen segment only.
    if (segmentId) {
      cols.push(
        {
          key: 'segFigure',
          label: 'Figura',
          defaultVisible: true,
          type: 'pills',
          pills: (r) => this.detailPills(r, segmentId, (pl) => pl.figureName),
          onCellClick: (r) => this.openSegmentCell(r, segmentId),
        },
        {
          key: 'segPosition',
          label: 'Posició',
          defaultVisible: true,
          type: 'pills',
          pills: (r) =>
            this.detailPills(r, segmentId, (pl) =>
              formatNodeCordonLabel(pl.nodeLabel, pl.renglaPosition),
            ),
          onCellClick: (r) => this.openSegmentCell(r, segmentId),
        },
        {
          key: 'segZone',
          label: 'Zona',
          defaultVisible: true,
          type: 'pills',
          pills: (r) => this.detailPills(r, segmentId, (pl) => ZONE_LABELS[pl.zone] ?? pl.zone),
          onCellClick: (r) => this.openSegmentCell(r, segmentId),
        },
      );
      return cols;
    }

    // Per-event scope (the default): one column per segment.
    for (const segment of this.segments()) {
      cols.push({
        key: `segment-${segment.id}`,
        label: this.segmentLabel(segment),
        defaultVisible: true,
        type: 'pills',
        pills: (r) => this.matrixPills(r, segment.id),
        onCellClick: (r) => this.openSegmentCell(r, segment.id),
      });
    }

    return cols;
  });

  readonly rowActions = computed<RowAction<ParticipationRow>[]>(() => {
    const scoped = this.selectedSegmentId();
    const segments = scoped
      ? this.segments().filter((s) => s.id === scoped)
      : this.segments();

    return segments.map((segment) => ({
      label: () => `Obre ${this.segmentLabel(segment)} al taller`,
      icon: ICON_FIGURA,
      hidden: (r: ParticipationRow) => !this.placementsFor(r, segment.id).length,
      action: (r: ParticipationRow) => {
        const [first] = this.placementsFor(r, segment.id);
        if (first) this.openAssignment(segment.id, first.instanceId);
      },
    }));
  });

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimeout);
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);
    this.participationService.getByEvent(this.eventId()).subscribe({
      next: (data) => {
        this.segments.set(data.segments);
        this.persons.set(data.persons);
        this.meta.set(data.meta);
        this.seedVisibleColumns();
        this.loading.set(false);
      },
      error: () => {
        this.loadError.set(true);
        this.loading.set(false);
      },
    });
  }

  // ── Cells ────────────────────────────────────────────────────────────────────

  /** All placements a person holds in one segment, unfiltered. Plural: never assume a
   *  single one. Conflict status is always computed against this set (§4.1): filtering
   *  the AREA never hides a conflict, only which of its placements gets painted. */
  allPlacementsFor(row: ParticipationRow, segmentId: string): ParticipationPlacement[] {
    return row.placements[segmentId] ?? [];
  }

  /** What actually gets rendered in a cell — narrowed by the area filter (Fase 6). */
  placementsFor(row: ParticipationRow, segmentId: string): ParticipationPlacement[] {
    const area = this.areaFilter();
    const all = this.allPlacementsFor(row, segmentId);
    return area ? all.filter((p) => p.area === area) : all;
  }

  isConflicted(row: ParticipationRow, segmentId: string): boolean {
    return this.allPlacementsFor(row, segmentId).length > 1;
  }

  /** % of segments the person shows up in, rounded — `0` for an event with no segments. */
  segmentPercent(row: ParticipationRow): number {
    const total = this.segments().length;
    if (total === 0) return 0;
    return Math.round((row.assignedSegmentCount / total) * 100);
  }

  /** Consolidated "en quin tronc està" cell: every TRONC/BASE placement across the whole
   *  event, prefixed by segment. Deliberately independent of the area filter — it is a
   *  question about troncs, not a view of whichever area is currently selected. */
  private troncPills(row: ParticipationRow): ColumnPill[] {
    const pills: ColumnPill[] = [];
    for (const segment of this.segments()) {
      const all = this.allPlacementsFor(row, segment.id);
      const tronc = all.filter((p) => p.area === 'TRONC');
      if (tronc.length === 0) continue;
      const conflicted = all.length > 1;
      for (const placement of tronc) {
        pills.push({
          text: `${this.segmentLabel(segment)}: ${formatNodeCordonLabel(placement.nodeLabel, placement.renglaPosition)} · ${placement.figureName}`,
          class: conflicted ? PILL_CONFLICT : PILL_POSITION,
        });
      }
    }
    return pills.length > 0 ? pills : [{ text: '—', class: PILL_EMPTY }];
  }

  /** Matrix cell: position + figure, or every placement in warning style when duplicated. */
  private matrixPills(row: ParticipationRow, segmentId: string): ColumnPill[] {
    const placements = this.placementsFor(row, segmentId);
    if (placements.length === 0) return [{ text: '—', class: PILL_EMPTY }];

    // The conflict — and its glyph-first warning styling — is a property of ALL of the
    // person's placements in this segment, even when the area filter is only painting
    // some of them (§4.1: a filter narrows what's shown, never what's a conflict).
    if (!this.isConflicted(row, segmentId)) {
      const [placement] = placements;
      return [
        {
          text: formatNodeCordonLabel(placement.nodeLabel, placement.renglaPosition),
          class: PILL_POSITION,
        },
        { text: placement.figureName, class: PILL_FIGURE },
      ];
    }

    // Conflict: this person would have to be in two places at once. Glyph first so the
    // warning does not rely on colour alone (projection, colour vision).
    return [
      { text: CONFLICT_GLYPH, class: PILL_CONFLICT },
      ...placements.map((placement) => ({
        text: `${formatNodeCordonLabel(placement.nodeLabel, placement.renglaPosition)} · ${placement.figureName}`,
        class: PILL_CONFLICT,
      })),
    ];
  }

  /** Segment-scope detail cell: one pill per placement, warning-styled when duplicated. */
  private detailPills(
    row: ParticipationRow,
    segmentId: string,
    text: (placement: ParticipationPlacement) => string,
  ): ColumnPill[] {
    const placements = this.placementsFor(row, segmentId);
    if (placements.length === 0) return [{ text: '—', class: PILL_EMPTY }];

    const conflicted = this.isConflicted(row, segmentId);
    return placements.map((placement) => ({
      text: text(placement),
      class: conflicted ? PILL_CONFLICT : PILL_POSITION,
    }));
  }

  /**
   * The conflict mark itself is rendered separately (`prefix` on the `person` column, in the
   * theme's error color) rather than folded into this plain-text label — it's the only one of
   * the three per-row marks that also survives horizontal scrolling, since this is the sticky
   * column, so it earns the extra visual weight the other two (👶, notes) don't need.
   */
  personLabel(row: ParticipationRow): string {
    const marks = [
      row.isXicalla ? '👶' : '',
      row.notes ? (row.notesEmoji ?? '⚠️') : '',
    ].filter(Boolean).join(' ');
    return marks ? `${row.alias} ${marks}` : row.alias;
  }

  /** Mirrors segment-manager's naming, but falls back to a short ordinal: a column header
   *  has no room for the concatenated figure list, which goes in the tooltip instead. */
  segmentLabel(segment: ParticipationSegment): string {
    if (segment.name?.trim()) return segment.name;
    return `Segment ${segment.sortOrder + 1}`;
  }

  segmentTooltip(segment: ParticipationSegment): string {
    return segment.figureNames.length > 0 ? segment.figureNames.join(' + ') : 'Sense figures';
  }

  statusLabel(status: AttendanceStatus): string {
    const past = this.isPast();
    const labels: Record<AttendanceStatus, string> = {
      PENDENT: past ? 'Sense resposta' : 'Pendent',
      ANIRE: past ? 'No presentat' : 'Aniré',
      NO_VAIG: past ? 'No va anar' : 'No vaig',
      ASSISTIT: 'Assistit',
    };
    return labels[status] ?? status;
  }

  statusBadgeClass(status: AttendanceStatus): string {
    const past = this.isPast();
    const classes: Record<AttendanceStatus, string> = {
      PENDENT: 'badge-ghost',
      ANIRE: past ? 'badge-warning' : 'badge-success',
      NO_VAIG: 'badge-error',
      ASSISTIT: 'badge-success',
    };
    return classes[status] ?? 'badge-ghost';
  }

  // ── Filters ──────────────────────────────────────────────────────────────────

  onSearchChange(value: string): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.search.set(value);
      this.resetPage();
    }, 200);
  }

  onSegmentChange(value: string): void {
    this.selectedSegmentId.set(value || null);
    // The column keys change with the scope, so the whitelist must be reseeded or the
    // table would render zero columns.
    this.seedVisibleColumns();
    this.resetPage();
  }

  onStatusChange(value: string): void {
    this.statusFilter.set(value ? (value as AttendanceStatus) : null);
    this.resetPage();
  }

  onPositionChange(value: string): void {
    this.positionFilter.set(this.availablePositions().find((p) => p.id === value) ?? null);
    this.resetPage();
  }

  toggleOnlyConflicts(): void {
    this.onlyConflicts.update((v) => !v);
    this.resetPage();
  }

  onAreaChange(value: string): void {
    this.areaFilter.set(value === 'TRONC' || value === 'PINYA' ? value : null);
    this.resetPage();
  }

  removeFilter(key: string): void {
    switch (key) {
      case 'search':
        this.search.set('');
        this.searchInput = '';
        break;
      case 'segment':
        this.selectedSegmentId.set(null);
        this.seedVisibleColumns();
        break;
      case 'status':
        this.statusFilter.set(null);
        break;
      case 'position':
        this.positionFilter.set(null);
        break;
      case 'conflicts':
        this.onlyConflicts.set(false);
        break;
      case 'area':
        this.areaFilter.set(null);
        break;
    }
    this.resetPage();
  }

  clearAllFilters(): void {
    this.search.set('');
    this.searchInput = '';
    this.selectedSegmentId.set(null);
    this.statusFilter.set(null);
    this.positionFilter.set(null);
    this.onlyConflicts.set(false);
    this.areaFilter.set(null);
    this.seedVisibleColumns();
    this.resetPage();
  }

  onSortChange(change: SortChange): void {
    this.sortBy.set(change.field as SortField);
    this.sortOrder.set(change.order);
    this.resetPage();
  }

  toggleColumn(key: string): void {
    this.visibleKeys.update((keys) =>
      keys.includes(key) ? keys.filter((k) => k !== key) : [...keys, key],
    );
  }

  onLimitChange(limit: number): void {
    this.limit.set(limit);
    this.resetPage();
  }

  /** Called from every filter handler, never from an effect: an effect would fight the
   *  paginator and undo the user's own page choice. */
  private resetPage(): void {
    this.page.set(1);
  }

  private seedVisibleColumns(): void {
    this.visibleKeys.set(this.columns().filter((c) => c.defaultVisible).map((c) => c.key));
  }

  // ── Search ranking ───────────────────────────────────────────────────────────

  private normalizeForMatch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  /**
   * alias-prefix > name-prefix > alias-substring > name-substring > what they do.
   *
   * That last tier is what makes "search by what a person does" work: typing `mans`
   * surfaces everyone placed at Mans, `4d7` surfaces that figure's crew. It ranks last
   * so an alias match always wins.
   */
  private matchRank(row: ParticipationRow, term: string): number | null {
    const alias = this.normalizeForMatch(row.alias);
    const name = this.normalizeForMatch(`${row.name} ${row.firstSurname}`);
    if (alias.startsWith(term)) return 0;
    if (name.startsWith(term)) return 1;
    if (alias.includes(term)) return 2;
    if (name.includes(term)) return 3;
    if (this.matchesPlacement(row, term)) return 4;
    return null;
  }

  private matchesPlacement(row: ParticipationRow, term: string): boolean {
    return Object.values(row.placements).some((placements) =>
      placements.some((placement) => {
        const figure = this.normalizeForMatch(placement.figureName);
        const position = this.normalizeForMatch(
          formatNodeCordonLabel(placement.nodeLabel, placement.renglaPosition),
        );
        return figure.includes(term) || position.includes(term);
      }),
    );
  }

  private rankByMatch(rows: ParticipationRow[], term: string): ParticipationRow[] {
    return rows
      .map((row) => ({ row, rank: this.matchRank(row, term) }))
      .filter((entry): entry is { row: ParticipationRow; rank: number } => entry.rank !== null)
      .sort((a, b) => a.rank - b.rank || a.row.alias.localeCompare(b.row.alias, 'ca'))
      .map((entry) => entry.row);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  navigateToPerson(row: ParticipationRow): void {
    this.router.navigate(['/persons', row.id]);
  }

  /**
   * Matrix/detail cell click: jumps straight into the workshop for what that cell shows.
   * Tab follows the placement's area (PINYA/TRONC); a conflict (>1 placement) follows the
   * first one, and an empty cell opens the segment — unassigned — in pinya mode.
   */
  private openSegmentCell(row: ParticipationRow, segmentId: string): void {
    const [first] = this.allPlacementsFor(row, segmentId);
    const tab = first?.area === 'PINYA' ? 'pinyes' : 'troncs';
    this.openAssignment(segmentId, first?.instanceId, tab);
  }

  private openAssignment(segmentId: string, instanceId: string | undefined, tab: 'pinyes' | 'troncs' = 'pinyes'): void {
    const queryParams: Record<string, string> = { returnUrl: eventReturnUrl(this.router), tab };
    if (this.isPast()) queryParams['past'] = '1';
    const commands = ['/pinyes/events', this.eventId(), 'segments', segmentId, 'assign'];
    if (instanceId) commands.push(instanceId);
    this.router.navigate(commands, { queryParams });
  }
}
