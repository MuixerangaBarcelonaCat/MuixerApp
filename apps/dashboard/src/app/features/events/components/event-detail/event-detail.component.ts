import { Component, ChangeDetectionStrategy, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { EventService } from '../../services/event.service';
import { AttendanceService } from '../../services/attendance.service';
import { SeasonService } from '../../services/season.service';
import { AuthService } from '../../../../core/auth/services/auth.service';
import { EventFormModalComponent } from '../event-form-modal/event-form-modal.component';
import { EventDetail, EventType, AttendanceSummary, SyncEvent, Season } from '../../models/event.model';
import { AttendanceItem, AttendanceFilterParams } from '../../models/attendance.model';
import { AttendanceStatus, PerformanceMetadata, RehearsalMetadata, UserRole } from '@muixer/shared';
import { environment } from '../../../../../environments/environment';

type SyncState = 'idle' | 'running' | 'complete' | 'error';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, EventFormModalComponent],
  templateUrl: './event-detail.component.html',
  styleUrls: ['./event-detail.component.scss'],
})
export class EventDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);

  private get listBase(): string {
    const url = this.router.url;
    return url.startsWith('/performances') ? '/performances' : '/rehearsals';
  }
  private readonly eventService = inject(EventService);
  private readonly attendanceService = inject(AttendanceService);
  private readonly seasonService = inject(SeasonService);

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

  syncState = signal<SyncState>('idle');
  syncMessage = signal('');
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
        this.loadAttendance();
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
        this.router.navigate([this.listBase]);
      },
      error: (err) => {
        this.deleting.set(false);
        if (err?.status === 409) {
          this.deleteError.set('No es pot eliminar un event que té registres d\'assistència.');
        } else {
          this.deleteError.set('Error en eliminar l\'esdeveniment.');
        }
      },
    });
  }

  loadAttendance() {
    const ev = this.event();
    if (!ev) return;

    this.loadingAttendance.set(true);
    const filters: AttendanceFilterParams = {
      status: this.attendanceStatusFilter(),
      search: this.attendanceSearch() || undefined,
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
    this.attendancePage.set(1);
    this.loadAttendance();
  }

  goToAttendancePage(p: number) {
    if (p < 1 || p > this.totalAttendancePages()) return;
    this.attendancePage.set(p);
    this.loadAttendance();
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
      [AttendanceStatus.PENDENT]: 'Sense resposta',
      [AttendanceStatus.ANIRE]: 'Aniré',
      [AttendanceStatus.NO_VAIG]: past ? 'No va anar' : 'No vaig',
      [AttendanceStatus.ASSISTIT]: 'Assistit',
      [AttendanceStatus.NO_PRESENTAT]: 'No presentat',
    };
    return labels[status] ?? status;
  }

  getStatusBadgeClass(status: AttendanceStatus): string {
    const classes: Record<AttendanceStatus, string> = {
      [AttendanceStatus.PENDENT]: 'badge-ghost',
      [AttendanceStatus.ANIRE]: 'badge-success',
      [AttendanceStatus.NO_VAIG]: 'badge-error',
      [AttendanceStatus.ASSISTIT]: 'badge-success',
      [AttendanceStatus.NO_PRESENTAT]: 'badge-warning',
    };
    return classes[status] ?? 'badge-ghost';
  }

  getSummaryForDisplay(summary: AttendanceSummary) {
    const past = this.isPast();
    return [
      { label: past ? 'Assistit' : 'Aniré', value: past ? summary.attended : summary.confirmed, icon: past ? '✅' : '🟢', hidden: false },
      { label: 'No presentat', value: summary.noShow, icon: '🟡', hidden: !past },
      { label: past ? 'No va anar' : 'No vaig', value: summary.declined, icon: '🔴', hidden: false },
      { label: 'Baixes tardanes', value: summary.lateCancel, icon: '⚠️', hidden: !past || summary.lateCancel === 0 },
      { label: past ? 'Sense resposta' : 'Pendents', value: summary.pending, icon: '⚪', hidden: false },
      { label: 'Xicalla', value: summary.children, icon: '👶', hidden: false },
      { label: 'Total', value: summary.total, icon: '#', hidden: false },
    ].filter((row) => !row.hidden);
  }
}
