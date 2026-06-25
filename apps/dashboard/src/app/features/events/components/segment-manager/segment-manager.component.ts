import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_FIGURA, ICON_PERSONA, ICON_COMPOSITION, ICON_FIGURA_NETA } from '../../../../shared/constants/domain-icons';
import { forkJoin } from 'rxjs';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { FigureInstanceService } from '../../../pinyes/services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import {
  FigurePickerModalComponent,
  InstanceSelection,
} from '../../../pinyes/components/figure-picker-modal/figure-picker-modal.component';
import {
  SegmentDetail,
  InstanceDetail,
  FigureMode,
  InstanceTroncSummary,
  TroncFloorData,
} from '../../../pinyes/models/segment.model';

export type ViewMode = 'pinyes' | 'troncs';

interface PendingInstanceRemoval {
  segment: SegmentDetail;
  instance: InstanceDetail;
}

interface PendingModeChange {
  segment: SegmentDetail;
  instance: InstanceDetail;
  mode: FigureMode;
}

@Component({
  selector: 'app-segment-manager',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule, FigurePickerModalComponent, DragDropModule],
  templateUrl: './segment-manager.component.html',
})
export class SegmentManagerComponent implements OnInit {
  eventId = input.required<string>();
  isLocked = input<boolean>(false);
  readonly ICON_FIGURA = ICON_FIGURA;
  readonly ICON_PERSONA = ICON_PERSONA;
  readonly ICON_COMPOSITION = ICON_COMPOSITION;
  readonly ICON_FIGURA_NETA = ICON_FIGURA_NETA;

  private readonly segmentService = inject(EventSegmentService);
  private readonly instanceService = inject(FigureInstanceService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  segments = signal<SegmentDetail[]>([]);
  loading = signal(false);
  saving = signal(false);

  editingSegmentId = signal<string | null>(null);
  editingName = signal('');

  pickerOpen = signal(false);
  pickerSegmentId = signal<string | null>(null);

  pendingInstanceRemoval = signal<PendingInstanceRemoval | null>(null);
  removingInstance = signal(false);

  pendingModeChange = signal<PendingModeChange | null>(null);
  savingModeChange = signal(false);

  viewMode = signal<ViewMode>('pinyes');
  troncData = signal<Map<string, TroncFloorData[]>>(new Map());
  troncLoading = signal(false);
  troncDataLoaded = signal(false);

  collapsedSegments = signal<Set<string>>(new Set());

  copyPickerInstanceId = signal<string | null>(null);
  copyPickerSegmentId = signal<string | null>(null);
  copyingInstance = signal(false);

  segmentTotalAssigned = computed(() => (segment: SegmentDetail): number =>
    segment.instances.reduce((sum, i) => sum + (i.assignedCount ?? 0), 0),
  );

  displayName = computed(() => (segment: SegmentDetail): string => {
    if (segment.name) return segment.name;
    if (!segment.instances.length) return 'Segment sense nom';
    return segment.instances
      .map((i) => this.getInstanceLabel(i))
      .join(' + ');
  });

  ngOnInit() {
    this.loadSegments();
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
    this.viewMode.set(mode);
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

  toggleVisibility(segment: SegmentDetail) {
    this.segmentService.update(this.eventId(), segment.id, { isVisible: !segment.isVisible }).subscribe({
      next: (updated) => {
        this.segments.update((list) => list.map((s) => (s.id === updated.id ? updated : s)));
      },
      error: () => this.toast.error('Error en canviar la visibilitat.'),
    });
  }

  removeSegment(segment: SegmentDetail) {
    const displayedName = this.displayName()(segment);
    if (!confirm(`Segur que vols eliminar "${displayedName}" i totes les seves figures? Aquesta acció no es pot desfer.`)) {
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

  onInstanceDropped(segment: SegmentDetail, event: CdkDragDrop<InstanceDetail[]>): void {
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

  getInstanceLabel(instance: InstanceDetail): string {
    const base = instance.label ?? instance.figureTemplate?.name ?? instance.compositionTemplate?.name ?? '?';
    if (instance.figureTemplate?.hasPinya) {
      if (instance.figureMode === 'PEU') return `Peu de ${base}`;
      if (instance.figureMode === 'REMAT') return `Remat de ${base}`;
      if (instance.figureMode === 'NETA') return `${base} ${this.netaSuffix(base)}`;
    }
    return base;
  }

  netaSuffix(name: string): string {
    const firstWord = name.trim().split(/\s+/)[0] ?? '';
    return firstWord.endsWith('a') ? 'neta' : 'net';
  }

  isComposition(instance: InstanceDetail): boolean {
    return !!instance.compositionTemplate;
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

  updateFigureMode(segment: SegmentDetail, instance: InstanceDetail, mode: FigureMode): void {
    if ((mode === 'REMAT' || mode === 'NETA') && instance.pinyaAssignedCount > 0) {
      this.pendingModeChange.set({ segment, instance, mode });
      // Optimistically reflect the selection so Angular controls the DOM value
      this.setInstanceMode(segment.id, instance.id, mode);
      return;
    }
    this.applyModeChange(segment, instance, mode);
  }

  confirmModeChange(): void {
    const pending = this.pendingModeChange();
    if (!pending) return;
    this.savingModeChange.set(true);
    this.instanceService.update(this.eventId(), pending.segment.id, pending.instance.id, { figureMode: pending.mode }).subscribe({
      next: (updated) => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === pending.segment.id
              ? { ...s, instances: s.instances.map((i) => (i.id === updated.id ? updated : i)) }
              : s,
          ),
        );
        this.savingModeChange.set(false);
        this.pendingModeChange.set(null);
      },
      error: () => {
        this.setInstanceMode(pending.segment.id, pending.instance.id, pending.instance.figureMode);
        this.toast.error('Error en actualitzar el mode de la figura.');
        this.savingModeChange.set(false);
        this.pendingModeChange.set(null);
      },
    });
  }

  cancelModeChange(): void {
    const pending = this.pendingModeChange();
    if (!pending) return;
    // Revert the optimistic update so the dropdown resets to the original value
    this.setInstanceMode(pending.segment.id, pending.instance.id, pending.instance.figureMode);
    this.pendingModeChange.set(null);
  }

  private setInstanceMode(segmentId: string, instanceId: string, mode: FigureMode): void {
    this.segments.update((list) =>
      list.map((s) =>
        s.id === segmentId
          ? { ...s, instances: s.instances.map((i) => (i.id === instanceId ? { ...i, figureMode: mode } : i)) }
          : s,
      ),
    );
  }

  private applyModeChange(
    segment: SegmentDetail,
    instance: InstanceDetail,
    mode: FigureMode,
    onDone?: () => void,
  ): void {
    this.instanceService.update(this.eventId(), segment.id, instance.id, { figureMode: mode }).subscribe({
      next: (updated) => {
        this.segments.update((list) =>
          list.map((s) =>
            s.id === segment.id
              ? { ...s, instances: s.instances.map((i) => (i.id === updated.id ? updated : i)) }
              : s,
          ),
        );
        onDone?.();
      },
      error: () => {
        this.toast.error('Error en actualitzar el mode de la figura.');
        onDone?.();
      },
    });
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
    this.router.navigate(route, { queryParams: { returnUrl: this.currentReturnUrl() } });
  }

  navigateToProjection(segmentId: string): void {
    this.router.navigate(
      ['/pinyes/events', this.eventId(), 'segments', segmentId, 'project'],
      { queryParams: { returnUrl: this.currentReturnUrl() } },
    );
  }

  private currentReturnUrl(): string {
    return this.router.url.split('?')[0];
  }
}
