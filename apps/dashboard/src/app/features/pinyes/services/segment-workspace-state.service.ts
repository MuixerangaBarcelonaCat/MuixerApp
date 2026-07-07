import { Injectable, computed, inject, signal } from '@angular/core';
import { FigureZone } from '@muixer/shared';
import { AssignmentStateService } from './assignment-state.service';
import { EventSegmentService } from './event-segment.service';
import { SegmentDistributionService } from './segment-distribution.service';
import { NodeAssignmentService, LockStatus } from './node-assignment.service';
import { ToastService } from '../../../shared/components/feedback/toast/toast.service';
import { SegmentDetail } from '../models/segment.model';
import { DistributionItem } from '../models/distribution.model';
import { InstanceNodeItem } from '../models/assignment.model';
import { CompositionSlotWithNodes } from '../components/figure-canvas/figure-canvas.component';
import { computeCordoObertOverrides } from '../utils/cordo-obert.util';
import { figureExtentFromNodes, placeNewFigure } from '../utils/figure-placement.util';

export interface WorkspaceInstance {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  figureTemplateName: string;
  hasPinya: boolean;
  figureMode: string;
  snapshotted: boolean;
  numberOfCordons: number | null;
  nodes: InstanceNodeItem[];
  assignedCount: number;
  totalCount: number;
}

/**
 * Per-workspace state for the unified segment workspace (P5.9).
 * Composes the root AssignmentStateService (selection, persons, flat
 * assignments across all instances) with segment/instance/distribution data.
 * Provided by SegmentWorkspaceComponent — one instance per workspace.
 */
@Injectable()
export class SegmentWorkspaceStateService {
  private readonly segmentService = inject(EventSegmentService);
  private readonly distributionService = inject(SegmentDistributionService);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly toast = inject(ToastService);
  readonly state = inject(AssignmentStateService);

  readonly eventId = signal('');
  readonly segmentId = signal('');
  readonly loading = signal(true);
  readonly notFound = signal(false);
  readonly segment = signal<SegmentDetail | null>(null);
  readonly instances = signal<WorkspaceInstance[]>([]);
  readonly distributionByInstance = signal<Map<string, DistributionItem>>(new Map());
  readonly selectedInstanceId = signal<string | null>(null);
  readonly lockStatus = signal<LockStatus | null>(null);
  readonly personsLoaded = signal(false);

  readonly segmentName = computed(() => this.segment()?.name ?? null);
  readonly isLocked = computed(() => this.lockStatus()?.locked ?? false);

  readonly selectedInstance = computed(
    () => this.instances().find((i) => i.instanceId === this.selectedInstanceId()) ?? null,
  );

  /** Slots for the pinya canvas: one per instance with pinya-canvas nodes, at stored or auto-placed positions. */
  readonly pinyaSlots = computed<CompositionSlotWithNodes[]>(() => {
    const distribution = this.distributionByInstance();

    const entries = this.instances()
      .map((instance) => ({
        instance,
        nodes: this.pinyaCanvasNodesFor(instance),
      }))
      .filter((e) => e.nodes.length > 0);

    const placedExtents: { x: number; width: number }[] = [];
    for (const { instance, nodes } of entries) {
      const item = distribution.get(instance.instanceId);
      if (item?.projectionX != null) {
        placedExtents.push({
          x: item.projectionX,
          width: figureExtentFromNodes(instance.instanceId, nodes).width,
        });
      }
    }

    return entries.map(({ instance, nodes }, index) => {
      const item = distribution.get(instance.instanceId);
      let offsetX: number;
      let offsetY: number;
      let angle: number;
      if (item?.projectionX != null) {
        offsetX = item.projectionX;
        offsetY = item.projectionY ?? 0;
        angle = item.projectionAngle ?? 0;
      } else {
        const placed = placeNewFigure(placedExtents, figureExtentFromNodes(instance.instanceId, nodes));
        placedExtents.push({
          x: placed.x,
          width: figureExtentFromNodes(instance.instanceId, nodes).width,
        });
        offsetX = placed.x;
        offsetY = placed.y;
        angle = placed.angle;
      }

      return {
        slotId: instance.instanceId,
        label: instance.label,
        offsetX,
        offsetY,
        sortOrder: index,
        angle,
        figureTemplate: {
          id: instance.figureTemplateId ?? instance.instanceId,
          name: instance.figureTemplateName,
          hasPinya: instance.hasPinya,
          // CompositionSlotWithNodes types nodes as FigureNodeItem; InstanceNodeItem is structurally compatible.
          nodes: nodes as unknown as CompositionSlotWithNodes['figureTemplate']['nodes'],
        },
      };
    });
  });

  load(eventId: string, segmentId: string): void {
    this.eventId.set(eventId);
    this.segmentId.set(segmentId);
    this.loading.set(true);
    this.notFound.set(false);
    this.state.reset();

    this.segmentService.getByEvent(eventId).subscribe({
      next: (resp) => {
        const seg = resp.data.find((s) => s.id === segmentId);
        if (!seg) {
          this.notFound.set(true);
          this.loading.set(false);
          return;
        }
        this.segment.set(seg);
        this.instances.set(
          seg.instances
            .filter((i) => !!i.figureTemplate)
            .map((instance) => ({
              instanceId: instance.id,
              label: this.computeInstanceLabel(
                instance.label ?? instance.figureTemplate?.name ?? '?',
                instance.figureMode ?? 'COMPLETA',
              ),
              figureTemplateId: instance.figureTemplate?.id ?? null,
              figureTemplateName: instance.figureTemplate?.name ?? '?',
              hasPinya: instance.figureTemplate?.hasPinya ?? true,
              figureMode: instance.figureMode ?? 'COMPLETA',
              snapshotted: instance.snapshotted,
              numberOfCordons: instance.numberOfCordons ?? null,
              nodes: [],
              assignedCount: instance.assignedCount ?? 0,
              totalCount: 0,
            })),
        );
        this.loading.set(false);
        for (const instance of this.instances()) {
          this.refreshInstance(instance.instanceId);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar el segment.');
      },
    });

    this.distributionService.getDistribution(eventId, segmentId).subscribe({
      next: (data) => {
        this.distributionByInstance.set(new Map(data.items.map((i) => [i.instanceId, i])));
      },
    });

    this.loadConfirmedPersons(eventId, segmentId);

    this.assignmentService.getLockStatus(eventId).subscribe({
      next: (status) => this.lockStatus.set(status),
    });
  }

  /** Reloads nodes + assignments for one instance and merges them into workspace state. */
  refreshInstance(instanceId: string): void {
    this.assignmentService.getInstanceNodes(instanceId).subscribe({
      next: (resp) => {
        this.instances.update((list) =>
          list.map((i) => {
            if (i.instanceId !== instanceId) return i;
            const totalCount = resp.data.filter(
              (n) =>
                n.zone !== FigureZone.DECORATION &&
                this.isNodeVisibleByCordons(n, i.numberOfCordons),
            ).length;
            const snapshotted = i.snapshotted || resp.data.some((n) => n.isSnapshotted);
            return { ...i, nodes: resp.data, totalCount, snapshotted };
          }),
        );
      },
    });

    this.assignmentService.getByInstance(instanceId).subscribe({
      next: (resp) => {
        this.state.assignments.update((list) => [
          ...list.filter((a) => a.figureInstanceId !== instanceId),
          ...resp.data,
        ]);
        this.instances.update((list) =>
          list.map((i) =>
            i.instanceId === instanceId ? { ...i, assignedCount: resp.data.length } : i,
          ),
        );
      },
    });
  }

  selectInstance(instanceId: string | null): void {
    this.selectedInstanceId.set(instanceId);
    this.state.setSelectedNodeId(null);
  }

  /** Nodes of one instance after cordons filtering and cordo-obert repositioning. */
  visibleNodesFor(instance: WorkspaceInstance): InstanceNodeItem[] {
    const cordons = instance.numberOfCordons;
    const nodes = instance.nodes;
    if (cordons === null) return nodes;

    const filtered = nodes.filter(
      (n) =>
        n.positionType === 'cordo-obert' ||
        !n.renglaId ||
        n.renglaPosition === null ||
        n.renglaPosition <= cordons,
    );

    const overrides = computeCordoObertOverrides(nodes, (_, others) =>
      others.find((n) => n.renglaPosition !== null && n.renglaPosition > cordons),
    );

    if (overrides.size === 0) return filtered;
    return filtered.map((n) => {
      const pos = overrides.get(n.id);
      return pos ? { ...n, x: pos.x, y: pos.y } : n;
    });
  }

  /** PINYA + BASE (unless REMAT) + DECORATION nodes for the pinya canvas. */
  private pinyaCanvasNodesFor(instance: WorkspaceInstance): InstanceNodeItem[] {
    const hideBase = instance.figureMode === 'REMAT';
    return this.visibleNodesFor(instance).filter(
      (n) =>
        n.zone === FigureZone.PINYA ||
        (!hideBase && n.zone === FigureZone.BASE) ||
        n.zone === FigureZone.DECORATION,
    );
  }

  private isNodeVisibleByCordons(
    node: { renglaId?: string | null; renglaPosition?: number | null; positionType?: string | null },
    numberOfCordons: number | null,
  ): boolean {
    if (numberOfCordons === null) return true;
    if (node.positionType === 'cordo-obert') return true;
    if (!node.renglaId) return true;
    if (node.renglaPosition === null || node.renglaPosition === undefined) return true;
    return node.renglaPosition <= numberOfCordons;
  }

  private computeInstanceLabel(base: string, figureMode: string): string {
    if (figureMode === 'PEU') return `Peu de ${base}`;
    if (figureMode === 'REMAT') return `Remat de ${base}`;
    if (figureMode === 'NETA') {
      const firstWord = base.trim().split(/\s+/)[0] ?? '';
      const suffix = firstWord.endsWith('a') ? 'neta' : 'net';
      return `${base} ${suffix}`;
    }
    return base;
  }

  private loadConfirmedPersons(eventId: string, segmentId: string): void {
    this.assignmentService
      .getAvailablePersons(eventId, segmentId, { excludeAssigned: false, isXicalla: false })
      .subscribe({
        next: (resp) => {
          this.state.confirmedPersons.set(resp.data);
          this.personsLoaded.set(true);
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
        },
      });
  }
}
