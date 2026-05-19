import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, RefreshCw, ChevronDown, ChevronUp } from 'lucide-angular';
import { NodeAssignmentService } from '../../services/node-assignment.service';
import { AssignmentStateService } from '../../services/assignment-state.service';
import { AvailablePerson, AssignmentDetail, HeightMode } from '../../models/assignment.model';

@Component({
  selector: 'app-person-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, LucideAngularModule],
  templateUrl: './person-panel.component.html',
})
export class PersonPanelComponent {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');

  readonly personSelected = output<AvailablePerson>();
  readonly assignedPersonSelected = output<{ personId: string; instanceId: string }>();

  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly state = inject(AssignmentStateService);

  readonly RefreshCw = RefreshCw;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  readonly persons = signal<AvailablePerson[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly height = signal<number | null>(null);
  readonly showXicalla = signal(false);
  readonly altresExpanded = signal(false);
  readonly assignadesExpanded = signal(true);

  readonly freePersons = computed(() =>
    this.persons().filter((p) => !p.assignedInSegment),
  );

  readonly confirmedPersons = computed(() =>
    this.freePersons().filter((p) => p.attendanceStatus === 'ANIRE'),
  );

  readonly pendingPersons = computed(() =>
    this.freePersons().filter((p) => p.attendanceStatus === 'PENDENT'),
  );

  readonly declinedPersons = computed(() =>
    this.freePersons().filter((p) => p.attendanceStatus === 'NO_VAIG'),
  );

  readonly assignedPersons = computed(() => {
    const apiAssigned = this.persons().filter((p) => p.assignedInSegment);
    const seen = new Set(apiAssigned.map((p) => p.id));
    const extras: AvailablePerson[] = [];

    // Supplement with current-instance assignments (optimistic / before API refresh)
    for (const assignment of this.assignments()) {
      if (seen.has(assignment.person.id)) continue;
      const fromList = this.persons().find((p) => p.id === assignment.person.id);
      extras.push({
        ...(fromList ?? {
          id: assignment.person.id,
          alias: assignment.person.alias,
          name: assignment.person.name,
          firstSurname: assignment.person.firstSurname,
          shoulderHeight: assignment.person.shoulderHeight,
          isXicalla: false,
          attendanceStatus: 'ANIRE',
          nextPerformanceStatus: null,
          assignedInSegment: true,
        }),
        assignedInSegment: true,
        assignedInstanceId: assignment.figureInstanceId,
        assignedNodeLabel: assignment.node.label,
      });
      seen.add(assignment.person.id);
    }

    return [...apiAssigned, ...extras];
  });

  constructor() {
    effect(() => {
      const nodeId = this.selectedNodeId();
      if (nodeId !== null) {
        setTimeout(() => this.focusSearch(), 0);
      }
    });

    effect(() => {
      this.state.personListRefreshTrigger();
      untracked(() => {
        if (this.eventId() && this.segmentId()) {
          this.loadPersons();
        }
      });
    });
  }

  focusSearch(): void {
    this.searchInputRef?.nativeElement.focus();
  }

  loadPersons(): void {
    this.loading.set(true);
    const query: Record<string, any> = {
      excludeAssigned: false,
    };
    if (this.search()) query['search'] = this.search();
    if (this.height() !== null) {
      const heightValue = this.height()!;
      const absoluteHeight = this.heightMode() === 'relative' ? 140 + heightValue : heightValue;
      query['height'] = absoluteHeight;
    }
    if (!this.showXicalla()) query['isXicalla'] = false;

    this.assignmentService
      .getAvailablePersons(this.eventId(), this.segmentId(), query)
      .subscribe({
        next: (resp) => {
          this.persons.set(resp.data);
          this.state.confirmedPersons.set(resp.data);

          // Update persistent registries on every load (merge, not replace)
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

          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    this.loadPersons();
  }

  onHeightChange(value: number | null): void {
    this.height.set(value);
    this.loadPersons();
  }

  onXicallaChange(checked: boolean): void {
    this.showXicalla.set(checked);
    this.loadPersons();
  }

  selectPerson(person: AvailablePerson): void {
    this.personSelected.emit(person);
  }

  navigateToAssigned(person: AvailablePerson): void {
    if (person.assignedInstanceId) {
      this.assignedPersonSelected.emit({
        personId: person.id,
        instanceId: person.assignedInstanceId,
      });
    }
  }

  formatHeight(person: AvailablePerson): string {
    if (person.shoulderHeight === null || person.shoulderHeight === 0 || person.shoulderHeight === 140) return '-';
    const h = person.shoulderHeight;
    if (this.heightMode() === 'relative') {
      const diff = h - 140;
      return diff >= 0 ? `+${diff}` : `${diff}`;
    }
    return `${h} cm`;
  }

  toggleAltres(): void {
    this.altresExpanded.update((v) => !v);
  }
}
