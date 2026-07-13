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
import {
  figureExtentFromNodes,
  placeFigures,
  placeNewFigure,
  PlacedFigurePosition,
} from '../utils/figure-placement.util';
import { pivotNodesFor } from '../utils/segment-assignment-render.util';

export interface WorkspaceInstance {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  figureTemplateName: string;
  hasPinya: boolean;
  figureMode: string;
  snapshotted: boolean;
  numberOfCordons: number | null;
  cordonsObertsEnabled: boolean;
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
  /** All segments of the event, ordered by sortOrder — powers prev/next navigation. */
  readonly segments = signal<SegmentDetail[]>([]);
  readonly instances = signal<WorkspaceInstance[]>([]);
  readonly distributionByInstance = signal<Map<string, DistributionItem>>(new Map());
  readonly selectedInstanceId = signal<string | null>(null);
  readonly lockStatus = signal<LockStatus | null>(null);
  readonly personsLoaded = signal(false);

  // Frozen per instance so adding/moving an ad-hoc node doesn't reflow other figures.
  private readonly autoPlacementExtentCache = new Map<string, { width: number; height: number }>();

  /**
   * True once every instance's initial node fetch (triggered by `load()`) has
   * settled (success or error). Consumers that fit a camera/viewport to
   * `pinyaSlots()` must wait for this — fitting on the first partial emission
   * (e.g. only 1 of 3 figures loaded) freezes the viewport on an incomplete
   * layout, since nothing re-fits once the rest of the figures arrive.
   */
  readonly instancesHydrated = signal(true);
  private readonly pendingInitialNodeLoads = new Set<string>();
  private readonly autoPlacementSpecCache = new Map<
    string,
    { pivotNodes: InstanceNodeItem[]; occupiedNodes: InstanceNodeItem[] }
  >();

  readonly segmentName = computed(() => this.segment()?.name ?? null);
  readonly isLocked = computed(() => this.lockStatus()?.locked ?? false);

  private readonly segmentIndex = computed(() =>
    this.segments().findIndex((s) => s.id === this.segmentId()),
  );
  readonly previousSegmentId = computed(() => {
    const index = this.segmentIndex();
    return index > 0 ? this.segments()[index - 1].id : null;
  });
  readonly nextSegmentId = computed(() => {
    const index = this.segmentIndex();
    const segments = this.segments();
    return index >= 0 && index < segments.length - 1 ? segments[index + 1].id : null;
  });
  /** 1-based position of the current segment among its siblings, e.g. { current: 3, total: 7 }. */
  readonly segmentPosition = computed(() => {
    const index = this.segmentIndex();
    return index >= 0 ? { current: index + 1, total: this.segments().length } : null;
  });

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
          // PINYA+BASE only, matching Distribució's own placeNewFigure fallback extent.
          width: this.stableAutoPlacementExtent(instance.instanceId, pivotNodesFor(nodes)).width,
        });
      }
    }

    // Fully-unplaced segment → space-optimizing layout for all figures at once,
    // matching the Distribució tab exactly: pivot = PINYA+BASE only (the
    // rotation-pivot convention every canvas mode uses), occupancy = the full
    // rendered set (PINYA+BASE+DECORATION, cordons/REMAT-filtered already by
    // pinyaCanvasNodesFor) so cordons/mode still shape packing space.
    let optimizedByInstance = new Map<string, PlacedFigurePosition>();
    if (entries.length > 0 && placedExtents.length === 0) {
      const specs = entries.map(({ instance, nodes }) => {
        const stable = this.stableAutoPlacementSpec(instance.instanceId, nodes);
        return {
          ...figureExtentFromNodes(instance.instanceId, stable.pivotNodes),
          nodes: stable.pivotNodes,
          occupiedNodes: stable.occupiedNodes,
        };
      });
      optimizedByInstance = new Map(placeFigures(specs).map((p) => [p.instanceId, p]));
    }

    return entries.map(({ instance, nodes }, index) => {
      const item = distribution.get(instance.instanceId);
      const optimized = optimizedByInstance.get(instance.instanceId);
      let offsetX: number;
      let offsetY: number;
      let angle: number;
      if (item?.projectionX != null) {
        offsetX = item.projectionX;
        offsetY = item.projectionY ?? 0;
        angle = item.projectionAngle ?? 0;
      } else if (optimized) {
        offsetX = optimized.x;
        offsetY = optimized.y;
        angle = optimized.angle;
      } else {
        const extent = this.stableAutoPlacementExtent(instance.instanceId, pivotNodesFor(nodes));
        const placed = placeNewFigure(placedExtents, { instanceId: instance.instanceId, ...extent });
        placedExtents.push({ x: placed.x, width: extent.width });
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

  /** Extent used for auto-placement, computed once per instance and reused thereafter. */
  private stableAutoPlacementExtent(
    instanceId: string,
    nodes: InstanceNodeItem[],
  ): { width: number; height: number } {
    const cached = this.autoPlacementExtentCache.get(instanceId);
    if (cached) return cached;
    const extent = figureExtentFromNodes(instanceId, nodes);
    if (nodes.length > 0) this.autoPlacementExtentCache.set(instanceId, extent);
    return extent;
  }

  /**
   * Pivot (PINYA+BASE only) and occupancy (the full rendered set) node lists
   * for the space-optimizing auto-placement, frozen per instance the first
   * time they're seen and reused thereafter — so adding an ad-hoc node to one
   * figure never reflows the others.
   */
  private stableAutoPlacementSpec(
    instanceId: string,
    occupiedNodes: InstanceNodeItem[],
  ): { pivotNodes: InstanceNodeItem[]; occupiedNodes: InstanceNodeItem[] } {
    const cached = this.autoPlacementSpecCache.get(instanceId);
    if (cached) return cached;
    const value = { pivotNodes: pivotNodesFor(occupiedNodes), occupiedNodes };
    if (occupiedNodes.length > 0) this.autoPlacementSpecCache.set(instanceId, value);
    return value;
  }

  load(eventId: string, segmentId: string): void {
    this.eventId.set(eventId);
    this.segmentId.set(segmentId);
    this.loading.set(true);
    this.notFound.set(false);
    this.instancesHydrated.set(false);
    this.state.reset();
    this.autoPlacementExtentCache.clear();

    this.segmentService.getByEvent(eventId).subscribe({
      next: (resp) => {
        this.segments.set(resp.data);
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
              cordonsObertsEnabled: instance.cordonsObertsEnabled,
              nodes: [],
              assignedCount: instance.assignedCount ?? 0,
              totalCount: 0,
            })),
        );
        this.loading.set(false);
        this.pendingInitialNodeLoads.clear();
        for (const instance of this.instances()) {
          this.pendingInitialNodeLoads.add(instance.instanceId);
        }
        this.instancesHydrated.set(this.pendingInitialNodeLoads.size === 0);
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

  /**
   * Re-fetches segment instance fields (label, figureMode, numberOfCordons,
   * snapshotted, assignedCount) and distribution positions, merging them into
   * the already-loaded instances. Call on tab activation so a figure edited in
   * one tab (e.g. cordons/mode/position in Distribució) shows up-to-date in
   * others (e.g. Pinyes, Troncs) — those signals are otherwise only populated
   * once by `load()` and go stale across tab switches.
   */
  refresh(): void {
    const eventId = this.eventId();
    const segmentId = this.segmentId();
    if (!eventId || !segmentId) return;

    this.segmentService.getByEvent(eventId).subscribe({
      next: (resp) => {
        this.segments.set(resp.data);
        const seg = resp.data.find((s) => s.id === segmentId);
        if (!seg) return;
        this.segment.set(seg);
        this.instances.update((list) =>
          list.map((existing) => {
            const fresh = seg.instances.find((i) => i.id === existing.instanceId);
            if (!fresh) return existing;
            return {
              ...existing,
              label: this.computeInstanceLabel(
                fresh.label ?? fresh.figureTemplate?.name ?? '?',
                fresh.figureMode ?? 'COMPLETA',
              ),
              figureMode: fresh.figureMode ?? 'COMPLETA',
              numberOfCordons: fresh.numberOfCordons ?? null,
              cordonsObertsEnabled: fresh.cordonsObertsEnabled,
              snapshotted: fresh.snapshotted,
              assignedCount: fresh.assignedCount ?? existing.assignedCount,
            };
          }),
        );
      },
    });

    this.distributionService.getDistribution(eventId, segmentId).subscribe({
      next: (data) => {
        this.distributionByInstance.set(new Map(data.items.map((i) => [i.instanceId, i])));
      },
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
        this.markInitialNodeLoadComplete(instanceId);
      },
      error: () => this.markInitialNodeLoadComplete(instanceId),
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

  private markInitialNodeLoadComplete(instanceId: string): void {
    if (this.pendingInitialNodeLoads.delete(instanceId) && this.pendingInitialNodeLoads.size === 0) {
      this.instancesHydrated.set(true);
    }
  }

  selectInstance(instanceId: string | null): void {
    this.selectedInstanceId.set(instanceId);
    this.state.setSelectedNodeId(null);
  }

  /** Nodes of one instance after cordons filtering and cordo-obert repositioning. */
  visibleNodesFor(instance: WorkspaceInstance): InstanceNodeItem[] {
    const cordons = instance.numberOfCordons;
    const nodes = instance.cordonsObertsEnabled
      ? instance.nodes
      : instance.nodes.filter((n) => n.positionType !== 'cordo-obert');
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
