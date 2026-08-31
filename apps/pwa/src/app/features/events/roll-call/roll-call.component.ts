import { Component, ChangeDetectionStrategy, OnDestroy, inject, input, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AttendanceStatus } from '@muixer/shared';
import { LucideAngularModule, Search } from 'lucide-angular';
import { BadgeComponent, ModalComponent, ToastService } from '@muixer/ui';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';
import { PersonLookupService, PersonSummaryResult } from '../services/person-lookup.service';

const SIGNED_UP_STATUSES = [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PENDENT]: 'Pendent',
  [AttendanceStatus.ANIRE]: 'Vindrà',
  [AttendanceStatus.NO_VAIG]: 'No vindrà',
  [AttendanceStatus.ASSISTIT]: 'Ha assistit',
};

@Component({
  selector: 'app-roll-call',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    LucideAngularModule,
    BadgeComponent,
    ModalComponent,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './roll-call.component.html',
})
export class RollCallComponent implements OnDestroy {
  readonly id = input.required<string>();

  protected readonly Search = Search;
  protected readonly statuses = [
    AttendanceStatus.ANIRE,
    AttendanceStatus.NO_VAIG,
    AttendanceStatus.ASSISTIT,
  ];

  private readonly rollCallService = inject(RollCallService);
  private readonly personLookupService = inject(PersonLookupService);
  private readonly toast = inject(ToastService);
  private addPersonDebounce?: ReturnType<typeof setTimeout>;

  protected readonly searchTerm = signal('');
  protected readonly showAll = signal(false);
  protected readonly items = signal<AttendanceItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly addPersonTerm = signal('');
  protected readonly addPersonResults = signal<PersonSummaryResult[]>([]);
  protected readonly overridePrompt = signal<{ item: AttendanceItem; status: AttendanceStatus } | null>(null);

  protected readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const base = this.showAll()
      ? this.items()
      : this.items().filter((item) => SIGNED_UP_STATUSES.includes(item.status));
    if (!term) return base;
    return base.filter((item) =>
      `${item.person.alias} ${item.person.name} ${item.person.firstSurname}`
        .toLowerCase()
        .includes(term),
    );
  });

  constructor() {
    // Required input isn't available synchronously in the constructor (e.g. in TestBed with
    // setInput called after createComponent) — defer the initial load to an effect instead.
    effect(() => this.load());
  }

  private load(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.rollCallService.getAttendance(this.id(), undefined).subscribe({
      next: (response) => {
        this.items.set(response.data);
        this.isLoading.set(false);
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
      },
    });
  }

  protected statusLabel(status: AttendanceStatus): string {
    return STATUS_LABELS[status];
  }

  protected statusVariant(status: AttendanceStatus): 'success' | 'error' | 'warning' | 'neutral' {
    switch (status) {
      case AttendanceStatus.ASSISTIT:
        return 'success';
      case AttendanceStatus.NO_VAIG:
        return 'error';
      case AttendanceStatus.ANIRE:
        return 'warning';
      default:
        return 'neutral';
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.addPersonDebounce);
  }

  protected setStatus(item: AttendanceItem, status: AttendanceStatus, force = false): void {
    this.rollCallService.updateAttendance(this.id(), item.id, force ? { status, force } : { status }).subscribe({
      next: (response) => {
        this.items.update((current) =>
          current.map((row) =>
            row.person.id === item.person.id
              ? { ...row, id: response.attendance.id, status: response.attendance.status }
              : row,
          ),
        );
        this.overridePrompt.set(null);
      },
      error: (err: unknown) => {
        if (err instanceof HttpErrorResponse && err.status === 403) {
          this.overridePrompt.set({ item, status });
          return;
        }
        this.toast.error("No s'ha pogut actualitzar l'assistència");
      },
    });
  }

  protected confirmOverride(): void {
    const prompt = this.overridePrompt();
    if (!prompt) return;
    this.setStatus(prompt.item, prompt.status, true);
  }

  protected cancelOverride(): void {
    this.overridePrompt.set(null);
  }

  protected onAddPersonInput(value: string): void {
    this.addPersonTerm.set(value);
    clearTimeout(this.addPersonDebounce);
    if (!value.trim()) {
      this.addPersonResults.set([]);
      return;
    }
    this.addPersonDebounce = setTimeout(() => {
      this.personLookupService.search(value.trim()).subscribe((results) => {
        const existingIds = new Set(this.items().map((item) => item.person.id));
        this.addPersonResults.set(results.filter((p) => !existingIds.has(p.id)));
      });
    }, 300);
  }

  protected addPerson(person: PersonSummaryResult): void {
    this.addPersonTerm.set('');
    this.addPersonResults.set([]);
    this.rollCallService
      .createAttendance(this.id(), { personId: person.id, status: AttendanceStatus.ASSISTIT })
      .subscribe({
        next: (response) => {
          this.items.update((current) => [
            ...current,
            { id: response.attendance.id, status: response.attendance.status, person },
          ]);
        },
        error: () => this.toast.error("No s'ha pogut afegir la persona"),
      });
  }
}
