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
import { LucideAngularModule } from 'lucide-angular';
import { ICON_FIGURA, ICON_PERSONA, ICON_COMPOSITION } from '../../../../shared/constants/domain-icons';
import { forkJoin } from 'rxjs';
import { EventSegmentService } from '../../../pinyes/services/event-segment.service';
import { FigureInstanceService } from '../../../pinyes/services/figure-instance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import {
  FigurePickerModalComponent,
  InstanceSelection,
} from '../../../pinyes/components/figure-picker-modal/figure-picker-modal.component';
import { SegmentDetail, InstanceDetail, FigureMode } from '../../../pinyes/models/segment.model';

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
  imports: [FormsModule, LucideAngularModule, FigurePickerModalComponent],
  templateUrl: './segment-manager.component.html',
})
export class SegmentManagerComponent implements OnInit {
  eventId = input.required<string>();
  isLocked = input<boolean>(false);
  readonly ICON_FIGURA = ICON_FIGURA;
  readonly ICON_PERSONA = ICON_PERSONA;
  readonly ICON_COMPOSITION = ICON_COMPOSITION;

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

  segmentTotalAssigned = computed(() => (segment: SegmentDetail): number =>
    segment.instances.reduce((sum, i) => sum + (i.assignedCount ?? 0), 0),
  );

  displayName = computed(() => (segment: SegmentDetail): string => {
    if (segment.name) return segment.name;
    if (!segment.instances.length) return 'Segment sense nom';
    return segment.instances
      .map((i) => i.figureTemplate?.name ?? i.compositionTemplate?.name ?? '?')
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

  createSegment() {
    this.saving.set(true);
    this.segmentService.create(this.eventId(), {}).subscribe({
      next: (segment) => {
        this.segments.update((list) => [...list, segment]);
        this.saving.set(false);
        this.startEdit(segment.id, segment.name ?? '');
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

  moveSegment(segment: SegmentDetail, direction: 'up' | 'down') {
    const list = [...this.segments()];
    const idx = list.findIndex((s) => s.id === segment.id);
    const newIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (newIdx < 0 || newIdx >= list.length) return;

    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    const reordered = list.map((s, i) => ({ ...s, sortOrder: i }));
    this.segments.set(reordered);

    this.segmentService.reorder(this.eventId(), reordered.map((s) => s.id)).subscribe({
      error: () => {
        this.toast.error('Error en reordenar els segments.');
        this.loadSegments();
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
    }
    return base;
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
    ];
  }

  updateFigureMode(segment: SegmentDetail, instance: InstanceDetail, mode: FigureMode): void {
    if (mode === 'REMAT' && instance.pinyaAssignedCount > 0) {
      this.pendingModeChange.set({ segment, instance, mode });
      return;
    }
    this.applyModeChange(segment, instance, mode);
  }

  confirmModeChange(): void {
    const pending = this.pendingModeChange();
    if (!pending) return;
    this.savingModeChange.set(true);
    this.applyModeChange(pending.segment, pending.instance, pending.mode, () => {
      this.savingModeChange.set(false);
      this.pendingModeChange.set(null);
    });
  }

  cancelModeChange(): void {
    this.pendingModeChange.set(null);
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
