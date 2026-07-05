import { Component, ChangeDetectionStrategy, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { NgClass } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_XICALLA, ICON_PERSONA, ICON_OBSERVACIONS } from '../../../../shared/constants/domain-icons';
import { EventService } from '../../services/event.service';
import { AttendanceService } from '../../services/attendance.service';
import { SeasonService } from '../../services/season.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { EventFormModalComponent } from '../event-form-modal/event-form-modal.component';
import { AttendanceEditModalComponent } from '../attendance-edit-modal/attendance-edit-modal.component';
import { SegmentManagerComponent } from '../segment-manager/segment-manager.component';
import { StatCardComponent } from '../../../../shared/components/data/stat-card/stat-card.component';
import { NodeAssignmentService, LockStatus } from '../../../pinyes/services/node-assignment.service';
import { getContrastColor } from '../../../../shared/utils/color.util';
import { EventAssignmentSummary, EventSegmentSummary } from '../../../pinyes/models/assignment.model';
import { EventDetail, EventType, AttendanceSummary, SyncEvent, Season } from '../../models/event.model';
import { getAdultsCount } from '../event-list/event-list.component';
import {
  AttendanceItem,
  AttendanceFilterParams,
  AttendanceCrudResponse,
  AttendanceDeleteResponse,
  AttendancePosition,
} from '../../models/attendance.model';
import { AttendanceStatus, PerformanceMetadata, RehearsalMetadata, UserRole } from '@muixer/shared';
import { environment } from '../../../../../environments/environment';

type SyncState = 'idle' | 'running' | 'complete' | 'error';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgClass,
    RouterModule,
    FormsModule,
    LucideAngularModule,
    EventFormModalComponent,
    AttendanceEditModalComponent,
    StatCardComponent,
    SegmentManagerComponent,
  ],
  templateUrl: './event-detail.component.html',
})
export class EventDetailComponent implements OnInit, OnDestroy {
  readonly ICON_XICALLA = ICON_XICALLA;
  readonly ICON_PERSONA = ICON_PERSONA;
  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  private get listBase(): string {
    return this.event()?.eventType === EventType.ACTUACIO ? '/performances' : '/rehearsals';
  }
  private readonly eventService = inject(EventService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly seasonService = inject(SeasonService);
  private readonly nodeAssignmentService = inject(NodeAssignmentService);

  readonly EventType = EventType;
  readonly AttendanceStatus = AttendanceStatus;

  isAdmin = computed(() => this.authService.userRole() === UserRole.ADMIN);

  event = signal<EventDetail | null>(null);
  loading = signal(true);
  loadingAttendance = signal(false);

  attendances = signal<AttendanceItem[]>([]);
  totalAttendances = signal(0);
  attendancePage = signal(1);
  attendanceLimit = signal(100);
  attendanceStatusFilter = signal<AttendanceStatus | undefined>(undefined);
  attendanceSearch = signal('');
  attendanceSearchInput = '';
  private attendanceSearchTimeout: ReturnType<typeof setTimeout> | undefined;

  showEditModal = signal(false);
  seasons = signal<Season[]>([]);

  deleting = signal(false);
  deleteError = signal<string | null>(null);

  editingAttendance = signal<AttendanceItem | null>(null);
  confirmedFilterActive = signal(true);
  positionFilter = signal<AttendancePosition | null>(null);

  syncState = signal<SyncState>('idle');
  syncMessage = signal('');

  lockStatus = signal<LockStatus | null>(null);
  isEventLocked = computed(() => this.lockStatus()?.locked ?? false);
  assignmentSummary = signal<EventAssignmentSummary | null>(null);
  summaryLoading = signal(false);
  private syncEventSource: EventSource | null = null;

  isPast = computed(() => {
    const ev = this.event();
    if (!ev) return false;
    const timeStr = ev.startTime ?? '23:59';
    return new Date(`${ev.date}T${timeStr}:00`) < new Date();
  });

  totalAttendancePages = computed(() =>
    Math.ceil(this.totalAttendances() / this.attendanceLimit()),
  );

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

  readonly getContrastColor = getContrastColor;

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
    this.loadEvent(id);
    this.seasonService.getAll().subscribe({
      next: (resp) => this.seasons.set(resp.data),
    });
  }

  private loadEvent(id: string) {
    this.loading.set(true);
    this.eventService.getOne(id).subscribe({
      next: (ev) => {
        this.event.set(ev);
        this.loading.set(false);
        if (this.confirmedFilterActive()) {
          const status = this.isPast() ? AttendanceStatus.ASSISTIT : AttendanceStatus.ANIRE;
          this.attendanceStatusFilter.set(status);
        }
        this.loadAttendance();
        this.nodeAssignmentService.getLockStatus(id).subscribe({
          next: (status) => this.lockStatus.set(status),
        });
        this.loadAssignmentSummary(id);
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

  goToConfirmation() {
    const ev = this.event();
    if (!ev) return;
    this.router.navigate(['/events', ev.id, 'confirmation']);
  }

  private loadAssignmentSummary(eventId: string) {
    this.summaryLoading.set(true);
    this.nodeAssignmentService.getEventAssignmentSummary(eventId).subscribe({
      next: (summary) => {
        this.assignmentSummary.set(summary);
        this.summaryLoading.set(false);
      },
      error: () => this.summaryLoading.set(false),
    });
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

  loadAttendance() {
    const ev = this.event();
    if (!ev) return;

    this.loadingAttendance.set(true);
    const pf = this.positionFilter();
    const filters: AttendanceFilterParams = {
      status: this.attendanceStatusFilter(),
      search: this.attendanceSearch() || undefined,
      positionIds: pf ? [pf.id] : undefined,
      page: this.attendancePage(),
      limit: this.attendanceLimit(),
    };

    this.attendanceService.getByEvent(ev.id, filters).subscribe({
      next: (resp) => {
        this.attendances.set(resp.data);
        this.totalAttendances.set(resp.meta.total);
        this.loadingAttendance.set(false);
      },
      error: () => this.loadingAttendance.set(false),
    });
  }

  onAttendanceSearchChange(value: string) {
    clearTimeout(this.attendanceSearchTimeout);
    this.attendanceSearchTimeout = setTimeout(() => {
      this.attendanceSearch.set(value);
      this.attendancePage.set(1);
      this.loadAttendance();
    }, 300);
  }

  onAttendanceStatusFilter(value: string) {
    this.attendanceStatusFilter.set(value ? (value as AttendanceStatus) : undefined);
    this.confirmedFilterActive.set(false);
    this.attendancePage.set(1);
    this.loadAttendance();
  }

  toggleConfirmedFilter() {
    const isActive = !this.confirmedFilterActive();
    this.confirmedFilterActive.set(isActive);
    const status = this.isPast() ? AttendanceStatus.ASSISTIT : AttendanceStatus.ANIRE;
    this.attendanceStatusFilter.set(isActive ? status : undefined);
    this.attendancePage.set(1);
    this.loadAttendance();
  }

  goToAttendancePage(p: number) {
    if (p < 1 || p > this.totalAttendancePages()) return;
    this.attendancePage.set(p);
    this.loadAttendance();
  }

  // --- Attendance CRUD ---

  openAttendanceEdit(att: AttendanceItem) {
    this.editingAttendance.set(att);
  }

  onAttendanceSaved(result: AttendanceCrudResponse) {
    // Optimistic local update — no full reload needed
    this.attendances.update((list) =>
      list.map((a) => (a.id === result.attendance.id ? result.attendance : a)),
    );
    this.event.update((ev) => ev ? { ...ev, attendanceSummary: result.summary } : ev);
    this.editingAttendance.set(null);
    this.toast.success('Assistència actualitzada.');
  }

  onAttendanceDeleted(result: AttendanceDeleteResponse) {
    const deleted = this.editingAttendance();
    this.attendances.update((list) => list.filter((a) => a.id !== deleted?.id));
    this.totalAttendances.update((n) => n - 1);
    this.event.update((ev) => ev ? { ...ev, attendanceSummary: result.summary } : ev);
    this.editingAttendance.set(null);
    this.toast.success('Registre d\'assistència eliminat.');
  }

  filterByPosition(pos: AttendancePosition): void {
    const current = this.positionFilter();
    this.positionFilter.set(current?.id === pos.id ? null : pos);
    this.attendancePage.set(1);
    this.loadAttendance();
  }

  clearPositionFilter(): void {
    this.positionFilter.set(null);
    this.attendancePage.set(1);
    this.loadAttendance();
  }

  navigateToPerson(personId: string): void {
    this.router.navigate(['/persons', personId]);
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
    clearTimeout(this.attendanceSearchTimeout);
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

  formatDateTime(isoStr: string | null): string {
    if (!isoStr) return '—';
    return new Date(isoStr).toLocaleDateString('ca-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  getStatusLabel(status: AttendanceStatus): string {
    const past = this.isPast();
    const labels: Record<AttendanceStatus, string> = {
      [AttendanceStatus.PENDENT]: past ? 'Sense resposta' : 'Pendent',
      [AttendanceStatus.ANIRE]: past ? 'No presentat' : 'Aniré',
      [AttendanceStatus.NO_VAIG]: past ? 'No va anar' : 'No vaig',
      [AttendanceStatus.ASSISTIT]: 'Assistit',
    };
    return labels[status] ?? status;
  }

  getStatusBadgeClass(status: AttendanceStatus): string {
    const past = this.isPast();
    const classes: Record<AttendanceStatus, string> = {
      [AttendanceStatus.PENDENT]: 'badge-ghost',
      [AttendanceStatus.ANIRE]: past ? 'badge-warning' : 'badge-success',
      [AttendanceStatus.NO_VAIG]: 'badge-error',
      [AttendanceStatus.ASSISTIT]: 'badge-success',
    };
    return classes[status] ?? 'badge-ghost';
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
