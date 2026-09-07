import {
  AssignmentDetail,
  BulkImportResult,
  FigureHistoryEntry,
  PinyaProjectionComponent,
  ProjectionSegmentData,
  TroncNodeItem,
  TroncViewComponent,
} from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnChanges,
  output,
  signal,
  SimpleChanges,
} from '@angular/core';
import { SlicePipe } from '@angular/common';
import { LucideAngularModule, Import } from 'lucide-angular';
import { FigureZone, ImportScope, zonesForScope } from '@muixer/shared';
import { ButtonComponent, ModalComponent, BadgeComponent } from '@muixer/ui';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { ProjectionService } from '../../services/projection.service';

@Component({
  selector: 'app-import-pinya-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    SlicePipe,
    ButtonComponent,
    ModalComponent,
    BadgeComponent,
    PinyaProjectionComponent,
    TroncViewComponent,
  ],
  templateUrl: './import-pinya-modal.component.html',
})
export class ImportPinyaModalComponent implements OnChanges {
  readonly figureTemplateId = input.required<string>();
  readonly currentInstanceId = input.required<string>();
  readonly open = input<boolean>(false);
  /**
   * Which panel opened the modal — scopes the offered imports: 'pinya' allows PINYA + everything,
   * 'tronc' allows TRONC + everything. Never lets you pull the other area in isolation.
   */
  readonly origin = input<'pinya' | 'tronc'>('pinya');

  readonly importCompleted = output<BulkImportResult>();
  readonly closed = output<void>();

  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly assignmentState = inject(AssignmentStateService);
  private readonly projectionService = inject(ProjectionService);

  readonly Import = Import;

  readonly history = signal<FigureHistoryEntry[]>([]);
  readonly loading = signal(false);
  readonly importing = signal(false);
  readonly selectedEntry = signal<FigureHistoryEntry | null>(null);
  readonly lastResult = signal<BulkImportResult | null>(null);
  readonly error = signal<string | null>(null);
  readonly confirmScope = signal<ImportScope | null>(null);

  /** Which scope the right-hand preview renders. Defaults to the whole figure. */
  readonly previewScope = signal<ImportScope>(ImportScope.ALL);
  readonly previewLoading = signal(false);
  readonly previewError = signal<string | null>(null);
  readonly projectionData = signal<ProjectionSegmentData | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['open'] && this.open()) {
      this.selectedEntry.set(null);
      this.lastResult.set(null);
      this.error.set(null);
      this.projectionData.set(null);
      this.previewError.set(null);
      this.loadHistory();
    }
  }

  private loadHistory(): void {
    this.loading.set(true);
    this.assignmentService.getHistory(this.figureTemplateId()).subscribe({
      next: (resp) => {
        const filtered = resp.data.filter((e) => e.instanceId !== this.currentInstanceId());
        this.history.set(filtered);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  /** Segment name and/or renamed figure label under the event title, joined with « - ». */
  entrySubtitle(entry: FigureHistoryEntry): string {
    return [entry.segmentName, entry.figureName].filter(Boolean).join(' - ');
  }

  /** Preview scope a freshly selected figure opens on: its own area in tronc mode, the whole figure otherwise. */
  private defaultScope(): ImportScope {
    return this.origin() === 'tronc' ? ImportScope.TRONC : ImportScope.ALL;
  }

  selectEntry(entry: FigureHistoryEntry): void {
    if (!entry.snapshotted) return;
    if (this.selectedEntry()?.instanceId === entry.instanceId) return;
    this.selectedEntry.set(entry);
    this.lastResult.set(null);
    this.error.set(null);
    this.previewScope.set(this.defaultScope());
    this.loadPreview(entry);
  }

  private loadPreview(entry: FigureHistoryEntry): void {
    this.previewLoading.set(true);
    this.previewError.set(null);
    this.projectionData.set(null);
    this.projectionService.getProjection(entry.eventId, entry.segmentId).subscribe({
      next: (data) => {
        this.projectionData.set(data);
        this.previewLoading.set(false);
      },
      error: () => {
        this.previewError.set('No s\'ha pogut carregar la previsualització.');
        this.previewLoading.set(false);
      },
    });
  }

  setPreviewScope(scope: ImportScope): void {
    this.previewScope.set(scope);
  }

  readonly ImportScope = ImportScope;

  /**
   * Import scopes offered for this origin, shared by the preview switch (`label`) and the
   * import-action rows (`actionLabel` — spelled out there since the button sits alone).
   */
  readonly scopes = computed<readonly { scope: ImportScope; label: string; actionLabel: string }[]>(() =>
    this.origin() === 'tronc'
      ? [
          { scope: ImportScope.TRONC, label: 'Tronc', actionLabel: 'Tronc' },
          { scope: ImportScope.ALL, label: 'Tot', actionLabel: 'Pinya i tronc' },
        ]
      : [
          { scope: ImportScope.PINYA, label: 'Pinya', actionLabel: 'Pinya' },
          { scope: ImportScope.ALL, label: 'Tot', actionLabel: 'Pinya i tronc' },
        ],
  );

  readonly title = computed(() =>
    this.origin() === 'tronc' ? 'Importació de tronc anterior' : 'Importació de pinya anterior',
  );

  private static readonly SCOPE_LABELS: Record<ImportScope, string> = {
    [ImportScope.PINYA]: 'pinya',
    [ImportScope.TRONC]: 'tronc',
    [ImportScope.ALL]: 'figura',
  };

  scopeLabel(scope: ImportScope): string {
    return ImportPinyaModalComponent.SCOPE_LABELS[scope];
  }

  countForScope(scope: ImportScope): number {
    const entry = this.selectedEntry();
    if (!entry) return 0;
    const zones = zonesForScope(scope);
    return zones
      ? entry.assignments.filter((a) => zones.has(a.zone)).length
      : entry.assignments.length;
  }

  /** Destination nodes already occupied within the given scope — these are never touched by import. */
  occupiedCountForScope(scope: ImportScope): number {
    const instanceId = this.currentInstanceId();
    const zones = zonesForScope(scope);
    return this.assignmentState
      .assignments()
      .filter((a) => a.figureInstanceId === instanceId && (!zones || zones.has(a.node.zone as FigureZone)))
      .length;
  }

  onImportClick(scope: ImportScope): void {
    if (this.occupiedCountForScope(scope) > 0) {
      this.confirmScope.set(scope);
      return;
    }
    this.doImport(scope);
  }

  confirmImport(): void {
    const scope = this.confirmScope();
    if (!scope) return;
    this.confirmScope.set(null);
    this.doImport(scope);
  }

  cancelConfirm(): void {
    this.confirmScope.set(null);
  }

  doImport(scope: ImportScope): void {
    const entry = this.selectedEntry();
    if (!entry) return;

    this.importing.set(true);
    this.error.set(null);

    this.assignmentService
      .bulkImport(this.currentInstanceId(), { sourceInstanceId: entry.instanceId, scope })
      .subscribe({
        next: (result) => {
          this.importing.set(false);
          this.lastResult.set(result);
          this.importCompleted.emit(result);
        },
        error: () => {
          this.importing.set(false);
          this.error.set('Error en importar les assignacions. Torna-ho a intentar.');
        },
      });
  }

  // ── preview node helpers (scoped to the selected entry's instance) ────────────

  private previewInstance() {
    const instanceId = this.selectedEntry()?.instanceId;
    return this.projectionData()?.instances.find((i) => i.id === instanceId) ?? null;
  }

  troncNodesFor(): TroncNodeItem[] {
    const inst = this.previewInstance();
    return inst ? (inst.nodes.filter((n) => n.zone === FigureZone.TRONC) as TroncNodeItem[]) : [];
  }

  baseNodesFor(): TroncNodeItem[] {
    const inst = this.previewInstance();
    return inst ? (inst.nodes.filter((n) => n.zone === FigureZone.BASE) as TroncNodeItem[]) : [];
  }

  directionNodesFor(): TroncNodeItem[] {
    const inst = this.previewInstance();
    return inst
      ? (inst.nodes.filter(
          (n) => n.zone === FigureZone.FIGURE_DIRECTION || n.zone === FigureZone.XICALLA_DIRECTION,
        ) as TroncNodeItem[])
      : [];
  }

  assignmentsFor(): AssignmentDetail[] {
    return this.previewInstance()?.assignments ?? [];
  }

  close(): void {
    this.closed.emit();
  }
}
