import { Component, ChangeDetectionStrategy, inject, input, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AttendanceStatus } from '@muixer/shared';
import { LucideAngularModule, Search } from 'lucide-angular';
import { BadgeComponent, ToastService } from '@muixer/ui';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

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
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
  ],
  templateUrl: './roll-call.component.html',
})
export class RollCallComponent {
  readonly id = input.required<string>();

  protected readonly Search = Search;
  protected readonly statuses = [
    AttendanceStatus.ANIRE,
    AttendanceStatus.NO_VAIG,
    AttendanceStatus.ASSISTIT,
  ];

  private readonly rollCallService = inject(RollCallService);
  private readonly toast = inject(ToastService);

  protected readonly searchTerm = signal('');
  protected readonly items = signal<AttendanceItem[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly filteredItems = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.items();
    return this.items().filter((item) =>
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

  protected setStatus(item: AttendanceItem, status: AttendanceStatus): void {
    this.rollCallService.updateAttendance(this.id(), item.id, { status }).subscribe({
      next: (response) => {
        this.items.update((current) =>
          current.map((row) =>
            row.person.id === item.person.id
              ? { ...row, id: response.attendance.id, status: response.attendance.status }
              : row,
          ),
        );
      },
      error: () => this.toast.error("No s'ha pogut actualitzar l'assistència"),
    });
  }
}
