import { Injectable, DestroyRef, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NodeAssignmentService } from '../../../services/node-assignment.service';
import { EventSegmentService } from '../../../services/event-segment.service';
import { FigureTemplateService } from '../../../services/figure-template.service';
import { FigureInstanceService } from '../../../services/figure-instance.service';
import { AssignmentStateService } from '../../../services/assignment-state.service';
import { ToastService } from '../../../../../shared/components/feedback/toast/toast.service';
import { SegmentDetail } from '../../../models/segment.model';
import { RenglaModel } from '../../../models/figure-template.model';
import { FigureZone } from '@muixer/shared';
import { InstanceNodeItem } from '../../../models/assignment.model';
import { repositionCordoObertNodes } from '../../../utils/cordo-obert-reposition.util';

export interface InstanceTab {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  snapshotted: boolean;
  numberOfCordons: number | null;
  openCordons: string[] | null;
  nodes: InstanceNodeItem[];
  assignedCount: number;
  totalCount: number;
}

/**
 * Component-scoped service owning tab/segment state and data loading.
 */
@Injectable()
export class AssignmentTabService {
  private readonly segmentService = inject(EventSegmentService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly assignmentService = inject(NodeAssignmentService);
  readonly instanceService = inject(FigureInstanceService);
  private readonly state = inject(AssignmentStateService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly tabs = signal<InstanceTab[]>([]);
  readonly segment = signal<SegmentDetail | null>(null);
  readonly loading = signal(false);
  readonly templateRengles = signal<RenglaModel[]>([]);
  readonly maxCordons = signal(0);

  readonly activeTab = computed(() =>
    this.tabs().find((t) => t.instanceId === this.state.activeInstanceId()) ?? null,
  );

  readonly activeNodes = computed(() => this.activeTab()?.nodes ?? []);

  readonly activePinyaNodes = computed(() => {
    const nodes = this.activeNodes().filter((n) => n.zone !== FigureZone.TRONC);
    const tab = this.activeTab();
    return repositionCordoObertNodes(nodes, tab?.numberOfCordons ?? null);
  });

  readonly activeTroncNodes = computed(() =>
    this.activeNodes().filter((n) => n.zone === FigureZone.TRONC),
  );

  readonly activeBaseNodes = computed(() =>
    this.activeNodes().filter((n) => n.zone === FigureZone.BASE),
  );

  readonly renglesWithCordoObert = computed(() =>
    this.templateRengles().filter((r) => r.allowsCordoObert),
  );

  readonly hasCordonsConfig = computed(() => this.templateRengles().length > 0);

  private eventId = '';
  private segmentId = '';

  init(eventId: string, segmentId: string): void {
    this.eventId = eventId;
    this.segmentId = segmentId;
    this.loadSegment();
  }

  selectTab(instanceId: string): void {
    this.state.activeInstanceId.set(instanceId);
    this.state.selectedNodeId.set(null);
    this.state.assignments.set([]);
    this.loadTabData(instanceId);
    this.loadTemplateRenglesForTab(instanceId);
  }

  loadTabData(instanceId: string): void {
    this.assignmentService.getInstanceNodes(instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, nodes: resp.data, totalCount: resp.data.length }
              : t,
          ),
        );
      },
    });

    this.assignmentService.getByInstance(instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.state.assignments.set(resp.data);
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, assignedCount: resp.data.length }
              : t,
          ),
        );
      },
    });
  }

  refreshInstanceNodes(instanceId: string): void {
    this.assignmentService.getInstanceNodes(instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        this.tabs.update((list) =>
          list.map((t) =>
            t.instanceId === instanceId
              ? { ...t, nodes: resp.data, totalCount: resp.data.length, snapshotted: true }
              : t,
          ),
        );
        this.assignmentService.getByInstance(instanceId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
          next: (assignResp) => {
            if (this.state.activeInstanceId() === instanceId) {
              this.state.assignments.set(assignResp.data);
            }
          },
        });
      },
    });
  }

  updateTabCount(instanceId: string): void {
    const count = this.state.assignments().length;
    this.tabs.update((list) =>
      list.map((t) => (t.instanceId === instanceId ? { ...t, assignedCount: count } : t)),
    );
  }

  markTabReset(instanceId: string): void {
    this.tabs.update((list) =>
      list.map((t) =>
        t.instanceId === instanceId ? { ...t, snapshotted: false, assignedCount: 0 } : t,
      ),
    );
  }

  markTabSnapshotted(instanceId: string): void {
    this.tabs.update((list) =>
      list.map((t) =>
        t.instanceId === instanceId ? { ...t, snapshotted: true } : t,
      ),
    );
  }

  removeTabs(instanceId: string): InstanceTab[] {
    const remaining = this.tabs().filter((t) => t.instanceId !== instanceId);
    this.tabs.set(remaining);
    return remaining;
  }

  updateTabCordons(instanceId: string, numberOfCordons: number | null, openCordons: string[] | null): void {
    this.tabs.update((list) =>
      list.map((t) =>
        t.instanceId === instanceId ? { ...t, numberOfCordons, openCordons } : t,
      ),
    );
  }

  getEventId(): string { return this.eventId; }
  getSegmentId(): string { return this.segmentId; }

  private loadSegment(): void {
    this.loading.set(true);
    this.segmentService.getByEvent(this.eventId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (resp) => {
        const seg = resp.data.find((s) => s.id === this.segmentId);
        if (!seg) {
          this.toast.error('Segment no trobat.');
          this.loading.set(false);
          return;
        }
        this.segment.set(seg);
        this.loading.set(false);
        this.buildTabs(seg);
      },
      error: () => {
        this.loading.set(false);
        this.toast.error('Error en carregar el segment.');
      },
    });
  }

  private buildTabs(seg: SegmentDetail): void {
    const built = seg.instances
      .filter((i) => !!i.figureTemplate)
      .map((instance): InstanceTab => ({
        instanceId: instance.id,
        label: instance.label ?? instance.figureTemplate?.name ?? '?',
        figureTemplateId: instance.figureTemplate?.id ?? null,
        snapshotted: instance.snapshotted,
        numberOfCordons: instance.numberOfCordons ?? null,
        openCordons: instance.openCordons ?? null,
        nodes: [],
        assignedCount: 0,
        totalCount: 0,
      }));

    this.tabs.set(built);
    if (built.length > 0) {
      this.selectTab(built[0].instanceId);
    }
  }

  private loadTemplateRenglesForTab(instanceId: string): void {
    const tab = this.tabs().find((t) => t.instanceId === instanceId);
    if (!tab?.figureTemplateId) return;

    this.figureTemplateService.getOne(tab.figureTemplateId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (template) => {
        this.templateRengles.set(template.rengles ?? []);
        const maxPos = (template.nodes ?? []).reduce(
          (max, n) => (n.renglaPosition != null && n.renglaPosition > max ? n.renglaPosition : max),
          0,
        );
        this.maxCordons.set(maxPos);
      },
    });
  }
}
