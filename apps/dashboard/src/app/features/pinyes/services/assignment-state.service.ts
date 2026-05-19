import { Injectable, computed, signal } from '@angular/core';
import {
  AssignmentDetail,
  AvailablePerson,
  HeightMode,
  PendingOp,
} from '../models/assignment.model';

@Injectable({
  providedIn: 'root',
})
export class AssignmentStateService {
  readonly selectedNodeId = signal<string | null>(null);
  readonly selectedPersonId = signal<string | null>(null);
  readonly activeInstanceId = signal<string | null>(null);
  readonly assignments = signal<AssignmentDetail[]>([]);
  readonly confirmedPersons = signal<AvailablePerson[]>([]);
  /**
   * Persistent attendance map built from unfiltered person loads.
   * Keyed by personId → attendanceStatus. Not reset on filtered searches.
   */
  readonly attendanceRegistry = signal<Map<string, string>>(new Map());
  /**
   * Persistent next-performance status map.
   * Keyed by personId → nextPerformanceStatus | null.
   */
  readonly nextPerformanceRegistry = signal<Map<string, string | null>>(new Map());
  readonly heightMode = signal<HeightMode>('relative');
  readonly panelCollapsed = signal<boolean>(false);
  readonly pendingOperations = signal<PendingOp[]>([]);
  /** Increment to request person-panel reload */
  readonly personListRefreshTrigger = signal(0);

  /** Number of confirmed (ANIRE) persons not yet assigned in the current segment */
  readonly freePersonsCount = computed(() => {
    const confirmed = this.confirmedPersons();
    const assigned = this.assignments();
    const assignedPersonIds = new Set(assigned.map((a) => a.person.id));
    return confirmed.filter(
      (p) => p.attendanceStatus === 'ANIRE' && !assignedPersonIds.has(p.id),
    ).length;
  });

  /** Total ANIRE persons */
  readonly totalConfirmedCount = computed(
    () => this.confirmedPersons().filter((p) => p.attendanceStatus === 'ANIRE').length,
  );

  setSelectedNodeId(nodeId: string | null): void {
    this.selectedNodeId.set(nodeId);
    if (nodeId !== null) {
      this.selectedPersonId.set(null);
    }
  }

  setSelectedPersonId(personId: string | null): void {
    this.selectedPersonId.set(personId);
    if (personId !== null) {
      this.selectedNodeId.set(null);
    }
  }

  toggleHeightMode(): void {
    this.heightMode.update((m) => (m === 'relative' ? 'absolute' : 'relative'));
  }

  refreshPersonList(): void {
    this.personListRefreshTrigger.update((n) => n + 1);
  }

  reset(): void {
    this.selectedNodeId.set(null);
    this.selectedPersonId.set(null);
    this.activeInstanceId.set(null);
    this.assignments.set([]);
    this.confirmedPersons.set([]);
    this.attendanceRegistry.set(new Map());
    this.nextPerformanceRegistry.set(new Map());
    this.heightMode.set('relative');
    this.panelCollapsed.set(false);
    this.pendingOperations.set([]);
  }
}
