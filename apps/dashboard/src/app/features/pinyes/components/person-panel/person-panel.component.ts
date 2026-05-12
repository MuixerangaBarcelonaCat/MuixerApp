import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnInit,
  OnChanges,
  SimpleChanges,
  ViewChild,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
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
export class PersonPanelComponent implements OnInit, OnChanges {
  @ViewChild('searchInput') searchInputRef?: ElementRef<HTMLInputElement>;

  readonly eventId = input.required<string>();
  readonly segmentId = input.required<string>();
  readonly selectedNodeId = input<string | null>(null);
  readonly assignments = input<AssignmentDetail[]>([]);
  readonly heightMode = input<HeightMode>('relative');

  readonly personSelected = output<AvailablePerson>();

  private readonly assignmentService = inject(NodeAssignmentService);
  private readonly state = inject(AssignmentStateService);

  readonly RefreshCw = RefreshCw;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;

  readonly persons = signal<AvailablePerson[]>([]);
  readonly loading = signal(false);
  readonly search = signal('');
  readonly height = signal<number | null>(null);
  readonly isXicalla = signal<boolean | undefined>(undefined);
  readonly excludeAssigned = signal(true);
  readonly altresExpanded = signal(false);

  readonly confirmedPersons = computed(() =>
    this.persons().filter((p) => p.attendanceStatus === 'ANIRE'),
  );

  readonly pendingPersons = computed(() =>
    this.persons().filter((p) => p.attendanceStatus === 'PENDENT'),
  );

  readonly declinedPersons = computed(() =>
    this.persons().filter((p) => p.attendanceStatus === 'NO_VAIG'),
  );

  constructor() {
    effect(() => {
      const nodeId = this.selectedNodeId();
      if (nodeId !== null) {
        setTimeout(() => this.focusSearch(), 0);
      }
    });
  }

  ngOnInit(): void {
    this.loadPersons();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['eventId'] || changes['segmentId']) {
      this.loadPersons();
    }
  }

  focusSearch(): void {
    this.searchInputRef?.nativeElement.focus();
  }

  loadPersons(): void {
    this.loading.set(true);
    const query: Record<string, any> = {
      excludeAssigned: this.excludeAssigned(),
    };
    if (this.search()) query['search'] = this.search();
    if (this.height() !== null) {
      const heightValue = this.height()!;
      const absoluteHeight = this.heightMode() === 'relative' ? 140 + heightValue : heightValue;
      query['height'] = absoluteHeight;
    }
    if (this.isXicalla() !== undefined) query['isXicalla'] = this.isXicalla();

    this.assignmentService
      .getAvailablePersons(this.eventId(), this.segmentId(), query)
      .subscribe({
        next: (resp) => {
          this.persons.set(resp.data);
          this.state.confirmedPersons.set(resp.data);
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
    this.isXicalla.set(checked ? true : undefined);
    this.loadPersons();
  }

  onExcludeAssignedChange(value: boolean): void {
    this.excludeAssigned.set(value);
    this.loadPersons();
  }

  selectPerson(person: AvailablePerson): void {
    this.personSelected.emit(person);
  }

  formatHeight(person: AvailablePerson): string {
    if (person.shoulderHeight === null) return '-';
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
