import { Component, ChangeDetectionStrategy, inject, input, signal, computed, effect, viewChild } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AttendanceStatus, matchesSearch, MeEventDetail } from '@muixer/shared';
import { Search } from 'lucide-angular';
import { formatEventDate } from '../../../shared/pipes/format-event-date.pipe';
import {
  ButtonComponent,
  ButtonGroupComponent,
  CardComponent,
  EmptyStateComponent,
  InputComponent,
  ModalComponent,
  TabsComponent,
  TabDef,
  ToastService,
} from '@muixer/ui';
import { MobileHeaderComponent } from '../../../shared/components/mobile-header/mobile-header.component';
import { SkeletonCardComponent } from '../../../shared/components/skeleton-card/skeleton-card.component';
import { PullToRefreshComponent } from '../../../shared/components/pull-to-refresh/pull-to-refresh.component';
import { EventService } from '../services/event.service';
import { RollCallService, AttendanceItem } from '../services/roll-call.service';

const SIGNED_UP_STATUSES = [AttendanceStatus.ANIRE, AttendanceStatus.ASSISTIT];

// ponytail: group membership frozen at load so changing status mid-session doesn't visually
// yank the row to the other list (feels like an error); recomputed on next `load()` (page revisit)
type RollCallRow = AttendanceItem & { signedUpGroup: boolean };

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PENDENT]: 'Pendent',
  [AttendanceStatus.ANIRE]: 'Vindrà',
  [AttendanceStatus.NO_VAIG]: 'No vindrà',
  [AttendanceStatus.ASSISTIT]: 'Ha vingut',
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
    ButtonComponent,
    ButtonGroupComponent,
    CardComponent,
    InputComponent,
    ModalComponent,
    TabsComponent,
    MobileHeaderComponent,
    SkeletonCardComponent,
    EmptyStateComponent,
    PullToRefreshComponent,
  ],
  templateUrl: './roll-call.component.html',
})
export class RollCallComponent {
  readonly id = input.required<string>();

  protected readonly Search = Search;
  /** Real-world order requested by user: physically arrived, signed up, declined last. */
  protected readonly statuses = [
    AttendanceStatus.ASSISTIT,
    AttendanceStatus.ANIRE,
    AttendanceStatus.NO_VAIG,
  ];

  private static readonly ALL_TAB_ID = 'all';
  protected readonly filterTabs: TabDef[] = [
    { id: RollCallComponent.ALL_TAB_ID, label: 'Tots' },
    ...this.statuses.map((status) => ({ id: status, label: STATUS_LABELS[status] })),
  ];

  private readonly rollCallService = inject(RollCallService);
  private readonly eventService = inject(EventService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  /**
   * Fetched directly rather than trusting `title`/`date` query params passed by the caller —
   * those are only set when arriving from event-detail, so a direct URL or a future entry point
   * would silently show nothing.
   */
  private readonly eventResource = rxResource<MeEventDetail, string>({
    params: () => this.id(),
    stream: ({ params }) => this.eventService.findOne(params),
  });
  protected readonly eventTitle = computed(() => this.eventResource.value()?.title ?? '');
  protected readonly eventDate = computed(() => {
    const date = this.eventResource.value()?.date;
    return date ? formatEventDate(date) : '';
  });

  private readonly initialStatus = this.route.snapshot.queryParamMap.get('status');
  protected readonly statusFilter = signal<AttendanceStatus | null>(
    this.statuses.includes(this.initialStatus as AttendanceStatus)
      ? (this.initialStatus as AttendanceStatus)
      : null,
  );
  protected readonly activeFilterTab = computed(() => this.statusFilter() ?? RollCallComponent.ALL_TAB_ID);

  protected readonly searchTerm = signal('');
  protected readonly items = signal<RollCallRow[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);

  protected readonly showAddProvisional = signal(false);
  protected readonly provisionalAlias = signal('');
  protected readonly isCreatingProvisional = signal(false);
  protected readonly overridePrompt = signal<{ item: AttendanceItem; status: AttendanceStatus } | null>(null);

  private readonly itemMatchesSearch = (item: AttendanceItem): boolean =>
    matchesSearch(
      `${item.person.alias} ${item.person.name} ${item.person.firstSurname}`,
      this.searchTerm(),
    );

  private readonly matchesFilters = (item: AttendanceItem): boolean => {
    const status = this.statusFilter();
    if (status && item.status !== status) return false;
    return this.itemMatchesSearch(item);
  };

  protected readonly signedUpItems = computed(() =>
    this.items().filter((item) => item.signedUpGroup && this.matchesFilters(item)),
  );
  protected readonly notSignedUpItems = computed(() =>
    this.items().filter((item) => !item.signedUpGroup && this.matchesFilters(item)),
  );
  protected readonly hasNoResults = computed(
    () => this.signedUpItems().length === 0 && this.notSignedUpItems().length === 0,
  );

  private readonly pullToRefresh = viewChild<PullToRefreshComponent>('pullRef');

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
        this.items.set(
          response.data.map((item) => ({ ...item, signedUpGroup: SIGNED_UP_STATUSES.includes(item.status) })),
        );
        this.isLoading.set(false);
        this.pullToRefresh()?.complete();
      },
      error: () => {
        this.hasError.set(true);
        this.isLoading.set(false);
        this.pullToRefresh()?.complete();
      },
    });
  }

  protected onRefresh(): void {
    this.eventResource.reload();
    this.load();
  }

  protected statusLabel(status: AttendanceStatus): string {
    return STATUS_LABELS[status];
  }

  protected setActiveFilterTab(id: string): void {
    this.statusFilter.set(id === RollCallComponent.ALL_TAB_ID ? null : (id as AttendanceStatus));
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
              { id: response.attendance.id, status: response.attendance.status, person, signedUpGroup: true },
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
