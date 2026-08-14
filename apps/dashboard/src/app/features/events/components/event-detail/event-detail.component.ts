import { Component, ChangeDetectionStrategy, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_XICALLA, ICON_PERSONA, ICON_FIGURA } from '../../../../shared/constants/domain-icons';
import { EventService } from '../../services/event.service';
import { SeasonService } from '../../services/season.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { EventFormModalComponent } from '../event-form-modal/event-form-modal.component';
import { AttendanceListComponent } from '../attendance-list/attendance-list.component';
import { EventParticipationComponent } from '../event-participation/event-participation.component';
import { SegmentManagerComponent } from '../segment-manager/segment-manager.component';
import { StatCardComponent } from '../../../../shared/components/data/stat-card/stat-card.component';
import { NodeAssignmentService, LockStatus } from '../../../pinyes/services/node-assignment.service';
import { EventDetail, EventType, AttendanceSummary, SyncEvent, Season } from '../../models/event.model';
import { getAdultsCount } from '../event-list/event-list.component';
import { PerformanceMetadata, RehearsalMetadata, UserRole } from '@muixer/shared';
import { environment } from '../../../../../environments/environment';

type SyncState = 'idle' | 'running' | 'complete' | 'error';

/** Sections of the event page, each on its own tab and deep-linkable via `?tab=`. */
export type EventDetailTab = 'resum' | 'pinyes' | 'assistencia' | 'participacio';

export const EVENT_DETAIL_TABS: readonly EventDetailTab[] = [
  'resum',
  'pinyes',
  'assistencia',
  'participacio',
];

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    LucideAngularModule,
    EventFormModalComponent,
    StatCardComponent,
    SegmentManagerComponent,
    AttendanceListComponent,
    EventParticipationComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit, OnDestroy {
  readonly ICON_XICALLA = ICON_XICALLA;
  readonly ICON_PERSONA = ICON_PERSONA;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  private get listBase(): string {
    return this.event()?.eventType === EventType.ACTUACIO ? '/performances' : '/rehearsals';
  }
  private readonly eventService = inject(EventService);
  private readonly seasonService = inject(SeasonService);
  private readonly nodeAssignmentService = inject(NodeAssignmentService);

  readonly EventType = EventType;

  isAdmin = computed(() => this.authService.userRole() === UserRole.ADMIN);

  event = signal<EventDetail | null>(null);
  loading = signal(true);

  showEditModal = signal(false);
  seasons = signal<Season[]>([]);

  deleting = signal(false);
  deleteError = signal<string | null>(null);

  syncState = signal<SyncState>('idle');
  syncMessage = signal('');

  lockStatus = signal<LockStatus | null>(null);
  isEventLocked = computed(() => this.lockStatus()?.locked ?? false);
  private syncEventSource: EventSource | null = null;

  readonly activeTab = signal<EventDetailTab>('pinyes');

  readonly tabDefs: { id: EventDetailTab; label: string; icon: string }[] = [
    { id: 'resum', label: 'Resum', icon: 'Info' },
    { id: 'pinyes', label: 'Pinyes i Figures', icon: ICON_FIGURA },
    { id: 'assistencia', label: 'Assistència', icon: 'UserCheck' },
    { id: 'participacio', label: 'Participació', icon: 'Grid3X3' },
  ];

  /**
   * Tabs are mounted lazily on first visit and then kept alive (hidden) so that
   * switching back does not refetch or lose the filters the user had set.
   */
  private readonly visitedTabs = signal<ReadonlySet<EventDetailTab>>(new Set(['pinyes']));

  hasVisited(tab: EventDetailTab): boolean {
    return this.visitedTabs().has(tab);
  }

  isPast = computed(() => {
    const ev = this.event();
    if (!ev) return false;
    const timeStr = ev.startTime ?? '23:59';
    return new Date(`${ev.date}T${timeStr}:00`) < new Date();
  });

  attendanceRatio = computed(() => {
    const ev = this.event();
    if (!ev || ev.attendanceSummary.total === 0) return 0;
    const numerator = this.isPast() ? ev.attendanceSummary.attended : ev.attendanceSummary.confirmed;
    return Math.round((numerator / ev.attendanceSummary.total) * 100);
  });

  adultsCount = computed(() => {
    const ev = this.event();
    if (!ev) return 0;
    return getAdultsCount(ev.attendanceSummary, this.isPast());
  });

  rehearsalMetadata = computed((): RehearsalMetadata | null => {
    const ev = this.event();
    if (!ev || ev.eventType !== EventType.ASSAIG) return null;
    return ev.metadata as RehearsalMetadata;
  });

  performanceMetadata = computed((): PerformanceMetadata | null => {
    const ev = this.event();
    if (!ev || ev.eventType !== EventType.ACTUACIO) return null;
    return ev.metadata as PerformanceMetadata;
  });

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const tabParam = this.route.snapshot.queryParams?.['tab'] as EventDetailTab | undefined;
    if (tabParam && EVENT_DETAIL_TABS.includes(tabParam)) {
      this.activeTab.set(tabParam);
      this.visitedTabs.update((visited) => new Set(visited).add(tabParam));
    }

    this.loadEvent(id);
    this.seasonService.getAll().subscribe({
      next: (resp) => this.seasons.set(resp.data),
    });
  }

  setTab(tab: EventDetailTab): void {
    this.activeTab.set(tab);
    this.visitedTabs.update((visited) => new Set(visited).add(tab));
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private loadEvent(id: string) {
    this.loading.set(true);
    this.eventService.getOne(id).subscribe({
      next: (ev) => {
        this.event.set(ev);
        this.loading.set(false);
        this.nodeAssignmentService.getLockStatus(id).subscribe({
          next: (status) => this.lockStatus.set(status),
        });
      },
      error: () => {
        this.loading.set(false);
        this.router.navigate([this.listBase]);
      },
    });
  }

  onEventUpdated(updated: EventDetail) {
    this.event.set(updated);
    this.showEditModal.set(false);
    this.toast.success('Esdeveniment actualitzat correctament.');
  }

  /** The attendance tab recalculated the summary — keep the stat cards and Resum in sync. */
  onSummaryChanged(summary: AttendanceSummary) {
    this.event.update((ev) => (ev ? { ...ev, attendanceSummary: summary } : ev));
  }

  goToConfirmation() {
    const ev = this.event();
    if (!ev) return;
    this.router.navigate(['/events', ev.id, 'confirmation']);
  }


  deleteEvent() {
    const ev = this.event();
    if (!ev) return;
    if (!confirm(`Segur que vols eliminar "${ev.title}"? Aquesta acció no es pot desfer.`)) return;

    this.deleting.set(true);
    this.deleteError.set(null);
    this.eventService.remove(ev.id).subscribe({
      next: () => {
        this.deleting.set(false);
        this.toast.success('Esdeveniment eliminat correctament.');
        this.router.navigate([this.listBase]);
      },
      error: (err) => {
        this.deleting.set(false);
        if (err?.status === 409) {
          const msg = 'No es pot eliminar un event que té registres d\'assistència.';
          this.deleteError.set(msg);
          this.toast.error(msg);
        } else {
          const msg = 'Error en eliminar l\'esdeveniment.';
          this.deleteError.set(msg);
          this.toast.error(msg);
        }
      },
    });
  }

  syncAttendance() {
    const ev = this.event();
    if (!ev || !ev.isSynced) return;

    if (!this.isAdmin()) {
      this.syncState.set('error');
      this.syncMessage.set('⛔ No tens permisos d\'administrador per executar la sincronització');
      return;
    }

    const token = this.authService.getAccessToken();
    if (!token) {
      this.syncState.set('error');
      this.syncMessage.set('⛔ No s\'ha pogut obtenir el token d\'autenticació');
      return;
    }

    this.syncState.set('running');
    this.syncMessage.set('Connectant...');

    const url = `${environment.apiUrl}/sync/events/${ev.id}/attendance?token=${encodeURIComponent(token)}`;
    this.syncEventSource = new EventSource(url);

    this.syncEventSource.onmessage = (msg) => {
      const syncEvent: SyncEvent = JSON.parse(msg.data as string);
      this.syncMessage.set(syncEvent.message);

      if (syncEvent.type === 'complete') {
        this.syncState.set('complete');
        this.closeSyncEventSource();
        this.loadEvent(ev.id);
      } else if (syncEvent.type === 'error') {
        this.syncState.set('error');
        this.closeSyncEventSource();
      }
    };

    this.syncEventSource.onerror = (err) => {
      const target = err.target as EventSource;
      if (target.readyState === EventSource.CLOSED) {
        this.syncMessage.set('⛔ No tens permisos d\'administrador per executar la sincronització');
      } else {
        this.syncMessage.set('Error de connexió amb el servidor');
      }
      this.syncState.set('error');
      this.closeSyncEventSource();
    };
  }

  private closeSyncEventSource() {
    if (this.syncEventSource) {
      this.syncEventSource.close();
      this.syncEventSource = null;
    }
  }

  ngOnDestroy() {
    this.closeSyncEventSource();
  }

  goBack() {
    this.router.navigate([this.listBase]);
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ca-ES', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  getSummaryForDisplay(summary: AttendanceSummary) {
    const past = this.isPast();
    const adults = getAdultsCount(summary, past);
    return [
      {
        label: past ? 'Assistit' : 'Aniré',
        value: past ? summary.attended : summary.confirmed,
        icon: 'UserCheck',
        iconClass: 'text-success',
        hidden: false,
      },
      {
        label: 'No presentat',
        value: summary.confirmed,
        icon: 'UserMinus',
        iconClass: 'text-warning',
        hidden: !past,
      },
      {
        label: past ? 'No va anar' : 'No vaig',
        value: summary.declined,
        icon: 'UserX',
        iconClass: 'text-error',
        hidden: false,
      },
      {
        label: 'Baixes tardanes',
        value: summary.lateCancel,
        icon: 'AlertCircle',
        iconClass: 'text-warning',
        hidden: !past || summary.lateCancel === 0,
      },
      {
        label: past ? 'Sense resposta' : 'Pendents',
        value: summary.pending,
        icon: 'Clock',
        iconClass: 'text-base-content/40',
        hidden: false,
      },
      {
        label: 'Adults',
        value: adults,
        icon: ICON_PERSONA,
        iconClass: 'text-primary',
        hidden: false,
      },
      {
        label: 'Xicalla',
        value: summary.children,
        icon: ICON_XICALLA,
        iconClass: 'text-info',
        hidden: false,
      },
      {
        label: 'Total',
        value: summary.total,
        icon: 'UsersRound',
        iconClass: 'text-base-content',
        hidden: false,
      },
    ].filter((row) => !row.hidden);
  }
}
