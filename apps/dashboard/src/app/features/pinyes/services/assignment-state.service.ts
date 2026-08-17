import { AssignmentArea, AssignmentDetail, AvailablePerson, HeightMode, InstanceNodeItem, PendingOp, isConfirmedAttendance } from '@muixer/pinyes-render';
import { Injectable, computed, signal } from '@angular/core';
import { NodePreset } from '@muixer/shared';

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

  /** Ad-hoc placement mode */
  readonly isPlacementMode = signal<boolean>(false);
  readonly placementPreset = signal<NodePreset | null>(null);
  readonly placementCustomLabel = signal<string | null>(null);

  /** Current active tab's nodes */
  readonly activeTabNodes = signal<InstanceNodeItem[]>([]);

  /** Derived: only ad-hoc nodes from the active tab */
  readonly adHocNodes = computed(() =>
    this.activeTabNodes().filter((n) => n.isAdHoc),
  );
  readonly hasAdHocNodes = computed(() => this.adHocNodes().length > 0);

  /**
   * Distinct confirmed adults (ANIRE/ASSISTIT), deduped by personId — defensive against Fase 5
   * duplicates, harmless today since the API still returns each person once.
   */
  private distinctConfirmedPersons(): AvailablePerson[] {
    const seen = new Set<string>();
    const result: AvailablePerson[] = [];
    for (const p of this.confirmedPersons()) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      if (!p.isXicalla && isConfirmedAttendance(p.attendanceStatus)) result.push(p);
    }
    return result;
  }

  /**
   * Number of confirmed adults not yet assigned in `area` of the current segment (§5.4):
   * TRONC → `!assignedInTronc`; PINYA/DIRECTION → no placement anywhere in the segment
   * (unchanged behaviour).
   */
  freeCountForArea(area: AssignmentArea): number {
    const localAssignedIds = new Set(this.assignments().map((a) => a.person.id));
    return this.distinctConfirmedPersons().filter((p) => {
      if (localAssignedIds.has(p.id)) return false;
      return area === 'TRONC' ? !p.assignedInTronc : p.assignedPlacements.length === 0;
    }).length;
  }

  /** Total distinct confirmed adults (ANIRE + ASSISTIT). */
  readonly totalConfirmedCount = computed(() => this.distinctConfirmedPersons().length);

  /**
   * Confirmed adults eligible for a NEW pinya placement (§5.2): confirmed minus those already
   * holding a tronc placement (BASE→TRONC, D10) — a person can't be at the tronc and the pinya
   * of the same figure at once. Computed client-side; no dedicated endpoint.
   */
  readonly pinyaEligibleCount = computed(
    () => this.distinctConfirmedPersons().filter((p) => !p.assignedInTronc).length,
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

  enterPlacementMode(preset: NodePreset, customLabel?: string): void {
    this.isPlacementMode.set(true);
    this.placementPreset.set(preset);
    this.placementCustomLabel.set(customLabel ?? null);
    this.selectedNodeId.set(null);
    this.selectedPersonId.set(null);
  }

  exitPlacementMode(): void {
    this.isPlacementMode.set(false);
    this.placementPreset.set(null);
    this.placementCustomLabel.set(null);
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
    this.isPlacementMode.set(false);
    this.placementPreset.set(null);
    this.placementCustomLabel.set(null);
    this.activeTabNodes.set([]);
  }
}
