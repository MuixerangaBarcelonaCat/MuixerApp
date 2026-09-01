import { Component, ChangeDetectionStrategy, inject, input, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { AttendanceStatus } from '@muixer/shared';
import { LucideAngularModule, Search } from 'lucide-angular';
import { BadgeComponent, ModalComponent, ToastService } from '@muixer/ui';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { EmptyStateComponent } from '../../../shared/components/empty-state/empty-state.component';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

const SIGNED_UP_STATUSES = [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT];

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PENDENT]: 'Pendent',
  [AttendanceStatus.ANIRE]: 'Vindrà',
  [AttendanceStatus.NO_VAIG]: 'No vindrà',
  [AttendanceStatus.ASSISTIT]: 'Ha assistit',
};

/** The API always returns a human Catalan message in the body for 4xx errors; fall back only for network/5xx failures. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
    return err.error.message;
  }
  return fallback;
}

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

  protected readonly showAddProvisional = signal(false);
  protected readonly provisionalAlias = signal('');
  protected readonly isCreatingProvisional = signal(false);
  protected readonly overridePrompt = signal<{ item: AttendanceItem; status: AttendanceStatus } | null>(null);

  private readonly matchesSearch = (item: AttendanceItem): boolean => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return true;
    return `${item.person.alias} ${item.person.name} ${item.person.firstSurname}`
      .toLowerCase()
      .includes(term);
  };

  protected readonly signedUpItems = computed(() =>
    this.items().filter((item) => SIGNED_UP_STATUSES.includes(item.status) && this.matchesSearch(item)),
  );
  protected readonly notSignedUpItems = computed(() =>
    this.items().filter((item) => !SIGNED_UP_STATUSES.includes(item.status) && this.matchesSearch(item)),
  );
  protected readonly hasNoResults = computed(
    () => this.signedUpItems().length === 0 && this.notSignedUpItems().length === 0,
  );

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
        this.toast.error(errorMessage(err, "No s'ha pogut actualitzar l'assistència"));
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

  protected toggleAddProvisional(): void {
    this.showAddProvisional.update((v) => !v);
    this.provisionalAlias.set('');
  }

  protected createProvisionalPerson(): void {
    const alias = this.provisionalAlias().trim();
    if (!alias) return;

    this.isCreatingProvisional.set(true);
    this.rollCallService.createProvisionalPerson(alias).subscribe({
      next: (person) => {
        this.rollCallService.createAttendance(this.id(), { personId: person.id, status: AttendanceStatus.ASSISTIT }).subscribe({
          next: (response) => {
            this.items.update((current) => [
              ...current,
              { id: response.attendance.id, status: response.attendance.status, person },
            ]);
            this.isCreatingProvisional.set(false);
            this.showAddProvisional.set(false);
          },
          error: (err: unknown) => {
            this.isCreatingProvisional.set(false);
            this.toast.error(errorMessage(err, "No s'ha pogut registrar l'assistència de la persona provisional"));
          },
        });
      },
      error: (err: unknown) => {
        this.isCreatingProvisional.set(false);
        this.toast.error(errorMessage(err, "No s'ha pogut crear la persona provisional"));
      },
    });
  }
}
