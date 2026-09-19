import { SegmentDetail, InstanceDetail, FigureMode, InstanceTroncSummary, TroncFloorData, MoveInstanceResult, EventFigureSummary, FigureAreaCount, SegmentPeopleCounters } from '@muixer/pinyes-render';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_FIGURA, ICON_PERSONA, ICON_COMPOSITION, ICON_FIGURA_NETA, ICON_PINYA, ICON_TRONC, ICON_RENGLA, ICON_DIRECCIO } from '../../../../shared/constants/domain-icons';
import {
  ICON_OBSERVACIONS,
  computeSegmentDisplayName,
  computeInstanceDisplayNames,
  getSegmentInstanceLabel,
  formatDirectionNames,
  DIRECCIO_PINYA_POSITION_TYPE,
} from '@muixer/shared';
import { forkJoin } from 'rxjs';
import { FiguresViewModeService, FiguresViewMode } from '../../../pinyes/services/figures-view-mode.service';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { FigureInstanceService } from '../../../pinyes/services/figure-instance.service';
import { CompositionService } from '../../../pinyes/services/composition.service';
import { NodeAssignmentService } from '../../../pinyes/services/node-assignment.service';
import { ToastService, AlertComponent, ButtonComponent, ButtonGroupComponent, BadgeComponent, CardComponent, ModalComponent, InputComponent, SelectComponent } from '@muixer/ui';
import {
  FigurePickerModalComponent,
  InstanceSelection,
} from '../../../pinyes/components/figure-picker-modal/figure-picker-modal.component';
import { FigureModeChangeComponent } from '../../../pinyes/components/figure-mode-change/figure-mode-change.component';
import { CordonsChangeComponent } from '../../../pinyes/components/cordons-change/cordons-change.component';
import { eventReturnUrl } from '../../utils/event-return-url.util';

export type ViewMode = FiguresViewMode;

interface PendingInstanceRemoval {
  segment: SegmentDetail;
  instance: InstanceDetail;
}



@Component({
  selector: 'app-segment-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    DragDropModule,
    AlertComponent,
    ButtonComponent,
    ButtonGroupComponent,
    BadgeComponent,
    CardComponent,
    ModalComponent,
    InputComponent,
    SelectComponent,
    FigurePickerModalComponent,
    FigureModeChangeComponent,
    CordonsChangeComponent,
  ],
  templateUrl: './segment-manager.component.html',
})
export class SegmentManagerComponent implements OnInit {
  eventId = input.required<string>();
  isLocked = input<boolean>(false);
  isPast = input<boolean>(false);
  readonly ICON_FIGURA = ICON_FIGURA;
  readonly ICON_PERSONA = ICON_PERSONA;
  readonly ICON_COMPOSITION = ICON_COMPOSITION;
  readonly ICON_FIGURA_NETA = ICON_FIGURA_NETA;
  readonly ICON_PINYA = ICON_PINYA;
  readonly ICON_TRONC = ICON_TRONC;
  readonly ICON_RENGLA = ICON_RENGLA;
  readonly ICON_DIRECCIO = ICON_DIRECCIO;
  readonly ICON_CONFLICT = ICON_OBSERVACIONS;

  private readonly segmentService = inject(EventSegmentService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly compositionService = inject(CompositionService);
  private readonly nodeAssignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly viewModeService = inject(FiguresViewModeService);

  segments = signal<SegmentDetail[]>([]);
  loading = signal(false);
  saving = signal(false);

  editingSegmentId = signal<string | null>(null);
  editingName = signal('');

  editingInstanceId = signal<string | null>(null);
  editingInstanceName = signal('');

  pickerOpen = signal(false);
  pickerSegmentId = signal<string | null>(null);

  pendingInstanceRemoval = signal<PendingInstanceRemoval | null>(null);
  removingInstance = signal(false);

  viewMode = this.viewModeService.mode;
  troncData = signal<Map<string, TroncFloorData[]>>(new Map());
  troncLoading = signal(false);
  troncDataLoaded = signal(false);

  collapsedSegments = signal<Set<string>>(new Set());

  copyPickerInstanceId = signal<string | null>(null);
  copyPickerSegmentId = signal<string | null>(null);
  copyingInstance = signal(false);

  movingInstanceId = signal<string | null>(null);

  instanceDropListIds = computed(() => this.segments().map((s) => 'instances-' + s.id));

  private readonly figuresBySegment = signal<Map<string, EventFigureSummary[]>>(new Map());
  /** Segment-level dotació/conflict counters (Phase 3). Empty in production until Phase 5. */
  private readonly conflictsBySegment = signal<Map<string, SegmentPeopleCounters>>(new Map());
  private readonly figureSummaryByInstance = computed(() => {
    const map = new Map<string, EventFigureSummary>();
    for (const figures of this.figuresBySegment().values()) {
      for (const f of figures) map.set(f.instanceId, f);
    }
    return map;
  });

  displayName = computed(() => (segment: SegmentDetail): string =>
    computeSegmentDisplayName(segment.name, segment.instances),
  );

  ngOnInit() {
    this.loadSegments();
    this.loadAssignmentSummary();
    if (this.viewMode() === 'troncs') {
      this.loadTroncView();
    }
  }

  private loadAssignmentSummary(): void {
    this.nodeAssignmentService.getEventAssignmentSummary(this.eventId()).subscribe({
      next: (summary) => {
        this.figuresBySegment.set(new Map(summary.segments.map((s) => [s.segmentId, s.figures])));
        this.conflictsBySegment.set(new Map(summary.segments.map((s) => [s.segmentId, s.conflicts])));
      },
      error: () => undefined,
    });
  }

  private loadSegments() {
    this.loading.set(true);
    this.segmentService.getByEvent(this.eventId()).subscribe({
      next: (resp) => {
        this.segments.set(resp.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar els segments.');
      },
    });
  }

  setViewMode(mode: ViewMode): void {
    this.viewModeService.set(mode);
    if (mode === 'troncs' && !this.troncDataLoaded()) {
      this.loadTroncView();
    }
  }

  private loadTroncView(): void {
    this.troncLoading.set(true);
    this.segmentService.getTroncView(this.eventId()).subscribe({
      next: (summaries: InstanceTroncSummary[]) => {
        const map = new Map<string, TroncFloorData[]>();
        for (const s of summaries) map.set(s.instanceId, s.floors);
        this.troncData.set(map);
        this.troncDataLoaded.set(true);
        this.troncLoading.set(false);
      },
      error: () => {
        this.troncLoading.set(false);
        this.toast.error('Error en carregar les dades del tronc.');
      },
    });
  }

  createSegment() {
    this.saving.set(true);
    this.segmentService.create(this.eventId(), {}).subscribe({
      next: (segment) => {
        this.segments.update((list) => [...list, segment]);
        this.saving.set(false);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Error en crear el segment.');
      },
    });
  }

  startEdit(segmentId: string, currentName: string) {
    this.editingSegmentId.set(segmentId);
    this.editingName.set(currentName);
  }

  cancelEdit() {
    this.editingSegmentId.set(null);
    this.editingName.set('');
  }

  saveSegmentName(segment: SegmentDetail) {
    const newName = this.editingName().trim() || null;
    this.segmentService.update(this.eventId(), segment.id, { name: newName }).subscribe({
      next: (updated) => {
        this.segments.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
        this.cancelEdit();
      },
      error: () => this.toast.error('Error en actualitzar el segment.'),
    });
  }

  startEditInstance(instanceId: string, currentLabel: string | null): void {
    this.editingInstanceId.set(instanceId);
    this.editingInstanceName.set(currentLabel ?? '');
  }

  cancelEditInstance(): void {
    this.editingInstanceId.set(null);
    this.editingInstanceName.set('');
  }

  saveInstanceName(segment: SegmentDetail, instance: InstanceDetail): void {
    const newLabel = this.editingInstanceName().trim() || null;
    this.instanceService.update(this.eventId(), segment.id, instance.id, { label: newLabel }).subscribe({
      next: (updated) => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === segment.id
              ? { ...s, instances: s.instances.map((i) => (i.id === updated.id ? updated : i)) }
              : s,
          ),
        );
        this.cancelEditInstance();
      },
      error: () => this.toast.error('Error en canviar el nom de la figura.'),
    });
  }

  toggleVisibility(segment: SegmentDetail) {
    this.segmentService.update(this.eventId(), segment.id, { isPublished: !segment.isPublished }).subscribe({
      next: (updated) => {
        this.segments.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      },
      error: () => this.toast.error('Error en canviar la visibilitat.'),
    });
  }

  /** True when at least one segment is published — drives the bulk publish toggle's label/icon. */
  readonly anySegmentPublished = computed(() => this.segments().some((s) => s.isPublished));

  /**
   * Bulk publish toggle: when nothing is published, publish every segment; when something is,
   * unpublish every published one. Only the segments that actually change are PATCHed.
   */
  toggleAllVisibility(): void {
    const publish = !this.anySegmentPublished();
    const targets = this.segments().filter((s) => s.isPublished !== publish);
    if (targets.length === 0) return;

    forkJoin(
      targets.map((s) => this.segmentService.update(this.eventId(), s.id, { isPublished: publish })),
    ).subscribe({
      next: (updated) => {
        const byId = new Map(updated.map((u) => [u.id, u]));
        this.segments.update((list) => list.map((s) => byId.get(s.id) ?? s));
      },
      error: () => this.toast.error('Error en canviar la visibilitat dels segments.'),
    });
  }

  removeSegment(segment: SegmentDetail) {
    const displayedName = this.displayName()(segment);
    if (!confirm(`Segur que vols eliminar "${displayedName}" i totes les seues figures? Esta acció no es pot desfer.`)) {
      return;
    }
    this.segmentService.remove(this.eventId(), segment.id).subscribe({
      next: () => {
        this.segments.update((list) => list.filter((s) => s.id !== segment.id));
        this.toast.success('Segment eliminat.');
      },
      error: () => this.toast.error('Error en eliminar el segment.'),
    });
  }

  onSegmentDropped(event: CdkDragDrop<SegmentDetail[]>): void {
    const { previousIndex, currentIndex } = event;
    if (previousIndex === currentIndex) return;

    const list = [...this.segments()];
    moveItemInArray(list, previousIndex, currentIndex);
    const reordered = list.map((s, i) => ({ ...s, sortOrder: i }));
    this.segments.set(reordered);

    this.segmentService.reorder(this.eventId(), reordered.map((s) => s.id)).subscribe({
      error: () => {
        this.toast.error('Error en reordenar els segments.');
        this.loadSegments();
      },
    });
  }

  onInstanceDropped(segment: SegmentDetail, event: CdkDragDrop<SegmentDetail>): void {
    if (event.previousContainer !== event.container) {
      this.moveInstanceAcrossSegments(
        event.previousContainer.data,
        segment,
        event.item.data as InstanceDetail,
        event.currentIndex,
      );
      return;
    }

    const { previousIndex, currentIndex } = event;
    if (previousIndex === currentIndex) return;

    const instances = [...segment.instances];
    moveItemInArray(instances, previousIndex, currentIndex);
    const reordered = instances.map((i, pos) => ({ ...i, sortOrder: pos }));

    this.segments.update((list) =>
      list.map((s) => (s.id === segment.id ? { ...s, instances: reordered } : s)),
    );

    this.instanceService.reorder(this.eventId(), segment.id, reordered.map((i) => i.id)).subscribe({
      error: () => {
        this.toast.error('Error en reordenar les figures.');
        this.loadSegments();
      },
    });
  }

  private moveInstanceAcrossSegments(
    sourceSegment: SegmentDetail,
    targetSegment: SegmentDetail,
    instance: InstanceDetail,
    targetIndex: number,
  ): void {
    this.movingInstanceId.set(instance.id);
    this.instanceService
      .move(this.eventId(), sourceSegment.id, instance.id, {
        targetSegmentId: targetSegment.id,
        targetIndex,
      })
      .subscribe({
        next: (result) => {
          this.movingInstanceId.set(null);
          this.applyMoveResult(result);
        },
        error: () => {
          this.movingInstanceId.set(null);
          this.toast.error('Error en moure la figura de segment.');
        },
      });
  }

  private applyMoveResult(result: MoveInstanceResult): void {
    this.segments.update((list) =>
      list.map((s) => {
        if (s.id === result.sourceSegment.id) return result.sourceSegment;
        if (s.id === result.targetSegment.id) return result.targetSegment;
        return s;
      }),
    );

    // D2/D3 (Fase 5): moving never blocks — a duplicate created by the move is a legal,
    // non-blocking conflict. Point the tècnic at the workshop's conflict panel to resolve
    // it there instead of duplicating that resolution UI here.
    if (result.conflicts?.length) {
      const n = result.conflicts.length;
      this.toast.warning(
        `${n} ${n === 1 ? 'persona ha quedat' : 'persones han quedat'} en conflicte en este segment. Resoleu-ho des de l'assignació.`,
      );
    }

    // conflictsBySegment only reflects the summary loaded at init — a move can create or
    // resolve a conflict in either segment, so the per-segment badge needs a fresh read.
    this.loadAssignmentSummary();
  }

  openCopyPicker(segmentId: string, instanceId: string): void {
    this.copyPickerSegmentId.set(segmentId);
    this.copyPickerInstanceId.set(instanceId);
  }

  closeCopyPicker(): void {
    this.copyPickerSegmentId.set(null);
    this.copyPickerInstanceId.set(null);
  }

  copyToSegment(targetSegmentId: string): void {
    const sourceSegmentId = this.copyPickerSegmentId();
    const instanceId = this.copyPickerInstanceId();
    if (!sourceSegmentId || !instanceId) return;

    this.copyingInstance.set(true);
    this.instanceService.copy(this.eventId(), sourceSegmentId, instanceId, { targetSegmentId }).subscribe({
      next: (newInstance) => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === targetSegmentId
              ? { ...s, instances: [...s.instances, newInstance] }
              : s,
          ),
        );
        this.copyingInstance.set(false);
        this.closeCopyPicker();
        this.toast.success('Figura copiada al segment.');
      },
      error: () => {
        this.copyingInstance.set(false);
        this.toast.error('Error en copiar la figura.');
      },
    });
  }

  openPicker(segmentId: string) {
    this.pickerSegmentId.set(segmentId);
    this.pickerOpen.set(true);
  }

  closePicker() {
    this.pickerOpen.set(false);
    this.pickerSegmentId.set(null);
  }

  onInstancesConfirmed(selections: InstanceSelection[]): void {
    const segmentId = this.pickerSegmentId();
    if (!segmentId || selections.length === 0) return;

    forkJoin(
      selections.map((sel) =>
        this.instanceService.create(this.eventId(), segmentId, sel),
      ),
    ).subscribe({
      next: (instances) => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === segmentId
              ? { ...s, instances: [...s.instances, ...instances] }
              : s,
          ),
        );
        const count = instances.length;
        this.toast.success(
          count === 1
            ? '1 figura afegida.'
            : `${count} figures afegides.`,
        );
        this.closePicker();
      },
      error: () => this.toast.error('Error en afegir les figures.'),
    });
  }

  onCompositionSelected(event: { compositionId: string; compositionName: string }): void {
    const segmentId = this.pickerSegmentId();
    if (!segmentId) return;

    this.compositionService.applyToSegment(this.eventId(), segmentId, event.compositionId).subscribe({
      next: (updatedSegment) => {
        this.segments.update((list) =>
          list.map((s) => (s.id === segmentId ? updatedSegment : s)),
        );
        this.toast.success(`Composició «${event.compositionName}» aplicada.`);
        this.closePicker();
      },
      error: () => this.toast.error('No s\'ha pogut aplicar la composició.'),
    });
  }

  removeInstance(segment: SegmentDetail, instance: InstanceDetail) {
    this.pendingInstanceRemoval.set({ segment, instance });
  }

  cancelInstanceRemoval(): void {
    this.pendingInstanceRemoval.set(null);
  }

  confirmInstanceRemoval(): void {
    const pending = this.pendingInstanceRemoval();
    if (!pending) return;

    this.removingInstance.set(true);
    this.instanceService.remove(this.eventId(), pending.segment.id, pending.instance.id).subscribe({
      next: () => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === pending.segment.id
              ? { ...s, instances: s.instances.filter((i) => i.id !== pending.instance.id) }
              : s,
          ),
        );
        this.removingInstance.set(false);
        this.pendingInstanceRemoval.set(null);
      },
      error: () => {
        this.removingInstance.set(false);
        this.toast.error('Error en eliminar la figura del segment.');
      },
    });
  }

  /**
   * The figure's display name, numbered against its siblings in `segment` when two or more
   * resolve to the same label («Pilar 1», «Pilar 2») — purely derived, so it stays in sync as
   * figures are added/removed/renamed without touching `instance.label` in the DB.
   */
  getInstanceLabel(instance: InstanceDetail, segment: SegmentDetail): string {
    return computeInstanceDisplayNames(segment.instances).get(instance.id) ?? getSegmentInstanceLabel(instance);
  }

  isComposition(_instance: InstanceDetail): boolean {
    return false;
  }

  figureModeOptions(instance: InstanceDetail): { value: FigureMode; label: string }[] | null {
    if (!instance.figureTemplate) return null;
    if (!instance.figureTemplate.hasPinya) return null;
    return [
      { value: 'COMPLETA', label: 'Completa' },
      { value: 'PEU', label: 'Peu' },
      { value: 'REMAT', label: 'Remat' },
      { value: 'NETA', label: 'Neta' },
    ];
  }

  @ViewChild(FigureModeChangeComponent) private figureModeChange!: FigureModeChangeComponent;

  updateFigureMode(segment: SegmentDetail, instance: InstanceDetail, mode: FigureMode): void {
    this.figureModeChange.request(this.eventId(), segment.id, instance.id, this.getInstanceLabel(instance, segment), mode);
  }

  /** A cancelled change never touches `instance.figureMode`, so the value bound to the <select>
   *  never changes and it wouldn't otherwise resync — but the native element already advanced
   *  to the user's (rejected) pick. This override briefly swaps the bound value out and back so
   *  the ngModel binding sees a genuine change and re-writes the control. */
  private readonly figureModeOverride = signal<Map<string, string>>(new Map());

  displayedFigureMode(instance: InstanceDetail): string {
    return this.figureModeOverride().get(instance.id) ?? instance.figureMode;
  }

  onFigureModeChangeCancelled(instanceId: string): void {
    this.figureModeOverride.update((m) => new Map(m).set(instanceId, ''));
    // A macrotask, not a microtask: the app is zoneless, so change detection runs on a
    // setTimeout/rAF race. A microtask would land before that tick and both writes would
    // collapse into one render, leaving ngModel with nothing to re-write.
    setTimeout(() => {
      this.figureModeOverride.update((m) => {
        const next = new Map(m);
        next.delete(instanceId);
        return next;
      });
    });
  }

  /** The updated instance's own segment isn't known here (the shared component is segment-agnostic),
   *  so find whichever segment currently holds this instance id — always exactly one. */
  onFigureModeChangeApplied(updated: InstanceDetail): void {
    this.segments.update((list) =>
      list.map((s) =>
        s.instances.some((i) => i.id === updated.id)
          ? { ...s, instances: s.instances.map((i) => (i.id === updated.id ? updated : i)) }
          : s,
      ),
    );
  }

  /**
   * Pinya view mode: a cordons stepper replaces the mode selector — figureMode
   * (Completa/Peu/Remat/Neta) is meaningless while looking at the pinya, but the cordon count
   * isn't. False when there's nothing to adjust (no pinya, REMAT/NETA — no pinya nodes shown —
   * or the template has no rengles at all).
   */
  hasCordonsControl(instance: InstanceDetail): boolean {
    return (
      !!instance.figureTemplate?.hasPinya &&
      instance.figureMode !== 'REMAT' &&
      instance.figureMode !== 'NETA' &&
      !!instance.totalCordons
    );
  }

  /** "2/4" or "Tots" (unlimited — numberOfCordons null). */
  cordonsDisplay(instance: InstanceDetail): string {
    return instance.numberOfCordons === null ? 'Tots' : `${instance.numberOfCordons}/${instance.totalCordons}`;
  }

  /** Pinya view mode, no cordons selector to show (REMAT/NETA/no pinya/no rengles): the figure's own mode as a static label. */
  figureModeLabel(instance: InstanceDetail): string {
    if (!instance.figureTemplate?.hasPinya) return 'Neta';
    if (instance.figureMode === 'REMAT') return 'Remat';
    if (instance.figureMode === 'NETA') return 'Neta';
    return 'Sense rengles';
  }

  @ViewChild(CordonsChangeComponent) private cordonsChange!: CordonsChangeComponent;

  /** 1 → 2 → … → totalCordons → Tots (null). No-op once at Tots. */
  onCordonsIncrement(instance: InstanceDetail): void {
    if (instance.numberOfCordons === null || instance.totalCordons === null) return;
    const next = instance.numberOfCordons >= instance.totalCordons ? null : instance.numberOfCordons + 1;
    this.cordonsChange.request(instance.id, next);
  }

  /** Tots (null) → totalCordons → … → 1. No-op once at 1. */
  onCordonsDecrement(instance: InstanceDetail): void {
    if (instance.numberOfCordons === 1) return;
    const next = (instance.numberOfCordons ?? instance.totalCordons ?? 1) - 1;
    this.cordonsChange.request(instance.id, next);
  }

  onCordonsChangeApplied(): void {
    // assignedCount/pinyaAssignedCount/totalCordons and the per-figure "needed people" label
    // all depend on which nodes the new cordon count keeps visible — refresh both without
    // touching `loading` (a full loadSegments() would flash the whole list away).
    this.refreshSegmentsSilently();
    this.loadAssignmentSummary();
  }

  private refreshSegmentsSilently(): void {
    this.segmentService.getByEvent(this.eventId()).subscribe({
      next: (resp) => this.segments.set(resp.data),
      error: () => undefined,
    });
  }

  /** "12/20 pinya (2 cor.), 15/24 total" — pinya fragment omitted when the figure has no pinya positions. */
  figurePinyaLabel(instance: InstanceDetail): string | null {
    const summary = this.figureSummaryByInstance().get(instance.id);
    if (!summary) return null;

    const totalPart = `${this.formatAreaCount(summary.total)} total`;
    if (summary.pinya.total === 0) return totalPart;

    const cordonsPart = this.showCordonsBadge(instance) ? ` (${instance.numberOfCordons} cor.)` : '';
    return `${this.formatAreaCount(summary.pinya)} pinya${cordonsPart}, ${totalPart}`;
  }

  /** "23/35 pinyes, 29/45 total" (pinya mode) or "4/10 troncs, 29/45 total" (troncs mode). */
  segmentPeopleLabel(segment: SegmentDetail): string | null {
    const figures = this.figuresBySegment().get(segment.id);
    if (!figures || figures.length === 0) return null;

    const total = this.sumAreaCounts(figures, (f) => f.total);
    const totalPart = `${this.formatAreaCount(total)} total`;

    if (this.viewMode() === 'troncs') {
      const tronc = this.sumAreaCounts(figures, (f) => f.tronc);
      return `${this.formatAreaCount(tronc)} troncs, ${totalPart}`;
    }

    const pinya = this.sumAreaCounts(figures, (f) => f.pinya);
    if (pinya.total === 0) return totalPart;
    return `${this.formatAreaCount(pinya)} pinyes, ${totalPart}`;
  }

  /** People holding >1 placement in the segment (Phase 3). 0 in production until Phase 5. */
  segmentConflictCount(segment: SegmentDetail): number {
    return this.conflictsBySegment().get(segment.id)?.conflictPersonCount ?? 0;
  }

  /** Tooltip with dotació per àrea (distinct people at tronc / pinya). Null when no summary. */
  segmentDotacioTooltip(segment: SegmentDetail): string | null {
    const c = this.conflictsBySegment().get(segment.id);
    if (!c) return null;
    const parts = [`${c.tronc.distinctPersonCount} al tronc`, `${c.pinya.distinctPersonCount} a la pinya`];
    if (c.conflictPersonCount > 0) {
      parts.push(`${c.conflictPersonCount} en conflicte`);
    }
    return parts.join(' · ');
  }

  private formatAreaCount(count: FigureAreaCount): string {
    return `${count.assigned}/${count.total}`;
  }

  private sumAreaCounts(
    figures: EventFigureSummary[],
    select: (f: EventFigureSummary) => FigureAreaCount,
  ): FigureAreaCount {
    return figures.reduce(
      (acc, f) => ({ assigned: acc.assigned + select(f).assigned, total: acc.total + select(f).total }),
      { assigned: 0, total: 0 },
    );
  }

  showCordonsBadge(instance: InstanceDetail): boolean {
    return (
      !!instance.figureTemplate?.hasPinya &&
      instance.figureMode !== 'REMAT' &&
      instance.figureMode !== 'NETA' &&
      instance.numberOfCordons !== null &&
      instance.totalCordons !== null &&
      instance.numberOfCordons < instance.totalCordons
    );
  }

  troncSummaryText(instance: InstanceDetail): string | null {
    const floors = this.troncData().get(instance.id);
    if (!floors || floors.length === 0) return null;

    let displayFloors = [...floors].sort((a, b) => {
      if (a.isBase && !b.isBase) return -1;
      if (!a.isBase && b.isBase) return 1;
      return a.z - b.z;
    });

    if (instance.figureMode === 'REMAT') {
      displayFloors = displayFloors.filter((f) => !f.isBase);
    }

    if (instance.figureMode === 'PEU') {
      let lastAssignedIdx = -1;
      for (let i = displayFloors.length - 1; i >= 0; i--) {
        if (displayFloors[i].slots.some((s) => s !== null)) {
          lastAssignedIdx = i;
          break;
        }
      }
      displayFloors = lastAssignedIdx >= 0 ? displayFloors.slice(0, lastAssignedIdx + 1) : [];
    }

    if (displayFloors.length === 0) return null;

    return displayFloors
      .map((f) => f.slots.map((s) => s ?? '?').join(' - '))
      .join(' // ');
  }

  /**
   * Troncs mode: every figure director on one line — «Quim · Aina (X) · Pep (P)», in the fixed
   * `DIRECTION_SLOTS` order (tronc → xicalla → pinya). Null when the figure has no directors.
   */
  directionSummaryText(instance: InstanceDetail): string | null {
    const directions = this.figureSummaryByInstance().get(instance.id)?.directions ?? [];
    const names = formatDirectionNames(directions);
    return names.length ? names.join(' · ') : null;
  }

  /**
   * Pinyes mode: the pinya director(s) only — «Marta», no flavour marker (the list is already
   * scoped to one flavour). Null when the figure has no pinya director.
   */
  pinyaDirectionText(instance: InstanceDetail): string | null {
    const directions = this.figureSummaryByInstance().get(instance.id)?.directions ?? [];
    const names = formatDirectionNames(directions, {
      positionTypes: [DIRECCIO_PINYA_POSITION_TYPE],
      markers: false,
    });
    return names.length ? names.join(' · ') : null;
  }

  isCollapsed(segmentId: string): boolean {
    return this.collapsedSegments().has(segmentId);
  }

  toggleCollapse(segmentId: string): void {
    this.collapsedSegments.update((set) => {
      const next = new Set(set);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  }

  collapseAll(): void {
    this.collapsedSegments.set(new Set(this.segments().map((s) => s.id)));
  }

  expandAll(): void {
    this.collapsedSegments.set(new Set());
  }

  otherSegments(currentSegmentId: string): SegmentDetail[] {
    return this.segments().filter((s) => s.id !== currentSegmentId);
  }

  segmentNumber(segmentId: string): number {
    return this.segments().findIndex((s) => s.id === segmentId) + 1;
  }

  navigateToAssignment(segmentId: string, instanceId: string | null = null): void {
    const route = ['/pinyes/events', this.eventId(), 'segments', segmentId, 'assign'];
    if (instanceId) {
      route.push(instanceId);
    }
    const qp: Record<string, string> = { returnUrl: this.currentReturnUrl() };
    if (this.isPast()) qp['past'] = '1';
    if (this.viewMode() === 'troncs') qp['tab'] = 'troncs';
    this.router.navigate(route, { queryParams: qp });
  }

  navigateToProjection(segmentId: string): void {
    this.router.navigate(
      ['/pinyes/events', this.eventId(), 'segments', segmentId, 'project'],
      { queryParams: { returnUrl: this.currentReturnUrl() } },
    );
  }

  /**
   * Where the assignment workspace and the projection should come back to: the event
   * page, on the section this manager was opened from (Pinyes i Figures).
   */
  private currentReturnUrl(): string {
    return eventReturnUrl(this.router);
  }
}
