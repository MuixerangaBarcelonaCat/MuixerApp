import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule, ArrowLeft, Users, Edit, RefreshCw } from 'lucide-angular';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { EventSegmentService } from '../../services/event-segment.service';
import { FigureTemplateService } from '../../services/figure-template.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { FigureCanvasComponent } from '../figure-canvas/figure-canvas.component';
import { PersonPanelComponent } from '../person-panel/person-panel.component';
import { NodePopoverComponent } from '../node-popover/node-popover.component';
import { ImportPinyaModalComponent } from '../import-pinya-modal/import-pinya-modal.component';
import {
  AssignmentDetail,
  AvailablePerson,
  BulkImportResult,
  PendingOp,
} from '../../models/assignment.model';
import { SegmentDetail, InstanceDetail } from '../../models/segment.model';
import { FigureNodeItem } from '../../models/figure-template.model';

interface InstanceTab {
  instanceId: string;
  label: string;
  figureTemplateId: string | null;
  nodes: FigureNodeItem[];
  assignedCount: number;
  totalCount: number;
}

@Component({
  selector: 'app-assignment-canvas',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    LucideAngularModule,
    FigureCanvasComponent,
    PersonPanelComponent,
    NodePopoverComponent,
    ImportPinyaModalComponent,
  ],
  templateUrl: './assignment-canvas.component.html',
})
export class AssignmentCanvasComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly segmentService = inject(EventSegmentService);
  private readonly figureTemplateService = inject(FigureTemplateService);
  private readonly toast = inject(ToastService);
  readonly state = inject(AssignmentStateService);

  readonly ArrowLeft = ArrowLeft;
  readonly Users = Users;
  readonly Edit = Edit;
  readonly RefreshCw = RefreshCw;

  readonly eventId = signal('');
  readonly segmentId = signal('');
  readonly loading = signal(false);
  readonly segment = signal<SegmentDetail | null>(null);
  readonly tabs = signal<InstanceTab[]>([]);
  readonly popoverAssignment = signal<AssignmentDetail | null>(null);
  readonly popoverPosition = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly importModalOpen = signal(false);

  readonly activeTab = computed(() =>
    this.tabs().find((t) => t.instanceId === this.state.activeInstanceId()) ?? null,
  );

  readonly activeNodes = computed(() => this.activeTab()?.nodes ?? []);

  readonly assignmentProgress = computed(() => {
    const tab = this.activeTab();
    if (!tab) return '';
    return `${tab.assignedCount}/${tab.totalCount}`;
  });

  readonly attendanceMap = computed(() => {
    const map = new Map<string, string>();
    const persons = this.state.confirmedPersons();
    persons.forEach((p) => map.set(p.id, p.attendanceStatus));
    return map;
  });

  ngOnInit(): void {
    const params = this.route.snapshot.params;
    this.eventId.set(params['eventId']);
    this.segmentId.set(params['segmentId']);
    this.state.reset();
    this.loadSegment();
  }

  private loadSegment(): void {
    this.loading.set(true);
    this.segmentService.getByEvent(this.eventId()).subscribe({
      next: (resp) => {
        const seg = resp.data.find((s) => s.id === this.segmentId());
        if (!seg) {
          this.toast.error('Segment no trobat.');
          this.goBack();
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
    const tabBuilders = seg.instances
      .filter((i) => !!i.figureTemplate)
      .map((instance): InstanceTab => ({
        instanceId: instance.id,
        label: instance.label ?? instance.figureTemplate?.name ?? '?',
        figureTemplateId: instance.figureTemplate?.id ?? null,
        nodes: [],
        assignedCount: 0,
        totalCount: 0,
      }));

    this.tabs.set(tabBuilders);

    if (tabBuilders.length > 0) {
      this.selectTab(tabBuilders[0].instanceId);
    }
  }

  selectTab(instanceId: string): void {
    this.state.activeInstanceId.set(instanceId);
    this.state.selectedNodeId.set(null);
    this.popoverAssignment.set(null);
    this.loadTabData(instanceId);
  }

  private loadTabData(instanceId: string): void {
    const tab = this.tabs().find((t) => t.instanceId === instanceId);
    if (!tab) return;

    // Load nodes from figure template
    if (tab.figureTemplateId) {
      this.figureTemplateService.getOne(tab.figureTemplateId).subscribe({
        next: (template) => {
          this.tabs.update((list) =>
            list.map((t) =>
              t.instanceId === instanceId
                ? { ...t, nodes: template.nodes, totalCount: template.nodes.length }
                : t,
            ),
          );
        },
      });
    }

    // Load assignments for this instance
    this.assignmentService.getByInstance(instanceId).subscribe({
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

  onNodeSelected(nodeId: string | null): void {
    if (!nodeId) {
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
      return;
    }

    const clickedNodeAssignment = this.state
      .assignments()
      .find((a) => a.node.id === nodeId);

    const previouslySelectedNodeId = this.state.selectedNodeId();
    const previousNodeAssignment = previouslySelectedNodeId
      ? this.state.assignments().find((a) => a.node.id === previouslySelectedNodeId)
      : null;

    if (clickedNodeAssignment && previousNodeAssignment && previouslySelectedNodeId !== nodeId) {
      this.triggerSwap(previousNodeAssignment, clickedNodeAssignment);
      this.state.setSelectedNodeId(null);
      this.popoverAssignment.set(null);
    } else if (clickedNodeAssignment) {
      this.popoverAssignment.set(clickedNodeAssignment);
      this.state.setSelectedNodeId(nodeId);
    } else {
      const pendingPersonId = this.state.selectedPersonId();
      this.state.setSelectedNodeId(nodeId);
      this.popoverAssignment.set(null);

      if (pendingPersonId) {
        this.triggerAssign(nodeId, pendingPersonId);
      }
    }
  }

  onNodeClicked(event: { nodeId: string; x: number; y: number }): void {
    this.popoverPosition.set({ x: event.x, y: event.y });
  }

  onPersonSelected(person: AvailablePerson): void {
    const selectedNodeId = this.state.selectedNodeId();

    if (!selectedNodeId) {
      // No node selected — mark person as selected
      this.state.setSelectedPersonId(person.id);
      return;
    }

    const existingAssignment = this.state
      .assignments()
      .find((a) => a.node.id === selectedNodeId);

    if (existingAssignment) {
      // Swap: unassign current, then assign new person
      this.triggerUnassignThenAssign(existingAssignment, selectedNodeId, person.id);
    } else {
      this.triggerAssign(selectedNodeId, person.id);
    }
  }

  private triggerAssign(nodeId: string, personId: string): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    // Optimistic update
    const snapshot = [...this.state.assignments()];
    const tempAssignment: AssignmentDetail = {
      id: `temp-${Date.now()}`,
      figureInstanceId: instanceId,
      compositionSlotId: null,
      node: this.activeNodes().find((n) => n.id === nodeId)! as any,
      person: { id: personId, alias: '...', name: '', firstSurname: '', shoulderHeight: null },
    };
    this.state.assignments.update((list) => [...list, tempAssignment]);
    this.state.setSelectedNodeId(null);

    const op: PendingOp = {
      id: `op-${Date.now()}`,
      type: 'assign',
      instanceId,
      nodeId,
      personId,
      previousAssignments: snapshot,
    };
    this.state.pendingOperations.update((ops) => [...ops, op]);

    this.assignmentService.assign(instanceId, { nodeId, personId }).subscribe({
      next: (created) => {
        // Replace temp with real assignment
        this.state.assignments.update((list) =>
          list.map((a) => (a.id === tempAssignment.id ? created : a)),
        );
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        this.updateTabCount(instanceId);
        this.advanceToNextEmptyNode(nodeId);
      },
      error: (err) => {
        // Rollback
        this.state.assignments.set(op.previousAssignments);
        this.state.pendingOperations.update((ops) => ops.filter((o) => o.id !== op.id));
        const msg = err?.status === 409
          ? 'Conflicte en assignar la persona. Ja pot estar assignada.'
          : 'Error en assignar la persona.';
        this.toast.error(msg);
      },
    });
  }

  private triggerUnassignThenAssign(
    existing: AssignmentDetail,
    nodeId: string,
    newPersonId: string,
  ): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== existing.id));
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, existing.id).subscribe({
      next: () => {
        this.triggerAssign(nodeId, newPersonId);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  private triggerSwap(assignment1: AssignmentDetail, assignment2: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    
    this.state.assignments.update((list) => 
      list.map(a => {
        if (a.id === assignment1.id) {
          return { ...a, person: assignment2.person };
        }
        if (a.id === assignment2.id) {
          return { ...a, person: assignment1.person };
        }
        return a;
      })
    );

    this.assignmentService.unassign(instanceId, assignment1.id).subscribe({
      next: () => {
        this.assignmentService.unassign(instanceId, assignment2.id).subscribe({
          next: () => {
            this.assignmentService.assign(instanceId, { 
              nodeId: assignment1.node.id, 
              personId: assignment2.person.id 
            }).subscribe({
              next: () => {
                this.assignmentService.assign(instanceId, { 
                  nodeId: assignment2.node.id, 
                  personId: assignment1.person.id 
                }).subscribe({
                  next: () => {
                    this.loadTabData(instanceId);
                    this.toast.success('Persones intercanviades correctament.');
                  },
                  error: () => {
                    this.state.assignments.set(snapshot);
                    this.toast.error('Error en l\'intercanvi de persones.');
                  }
                });
              },
              error: () => {
                this.state.assignments.set(snapshot);
                this.toast.error('Error en l\'intercanvi de persones.');
              }
            });
          },
          error: () => {
            this.state.assignments.set(snapshot);
            this.toast.error('Error en l\'intercanvi de persones.');
          }
        });
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en l\'intercanvi de persones.');
      }
    });
  }

  onUnassign(assignment: AssignmentDetail): void {
    const instanceId = this.state.activeInstanceId();
    if (!instanceId) return;

    const snapshot = [...this.state.assignments()];
    this.state.assignments.update((list) => list.filter((a) => a.id !== assignment.id));
    this.popoverAssignment.set(null);
    this.state.setSelectedNodeId(null);

    this.assignmentService.unassign(instanceId, assignment.id).subscribe({
      next: () => {
        this.updateTabCount(instanceId);
      },
      error: () => {
        this.state.assignments.set(snapshot);
        this.toast.error('Error en desassignar la persona.');
      },
    });
  }

  private advanceToNextEmptyNode(justAssignedNodeId: string): void {
    const nodes = this.activeNodes();
    const assignments = this.state.assignments();
    const assignedNodeIds = new Set(assignments.map((a) => a.node.id));
    const currentIndex = nodes.findIndex((n) => n.id === justAssignedNodeId);
    if (currentIndex === -1) return;

    for (let i = currentIndex + 1; i < nodes.length; i++) {
      if (!assignedNodeIds.has(nodes[i].id)) {
        this.state.setSelectedNodeId(nodes[i].id);
        return;
      }
    }
    this.state.setSelectedNodeId(null);
  }

  private updateTabCount(instanceId: string): void {
    const count = this.state.assignments().length;
    this.tabs.update((list) =>
      list.map((t) => (t.instanceId === instanceId ? { ...t, assignedCount: count } : t)),
    );
  }

  onImportCompleted(result: BulkImportResult): void {
    const msg = result.conflicts.length > 0
      ? `Importades ${result.created.length} assignacions (${result.conflicts.length} conflictes omesos).`
      : `Importades ${result.created.length} assignacions correctament.`;
    this.toast.success(msg);
    this.importModalOpen.set(false);
    const instanceId = this.state.activeInstanceId();
    if (instanceId) this.loadTabData(instanceId);
  }

  getAttendanceStatus(assignment: AssignmentDetail): string | null {
    return this.attendanceMap().get(assignment.person.id) ?? null;
  }

  goBack(): void {
    this.router.navigate(['/events', this.eventId()]);
  }
}
