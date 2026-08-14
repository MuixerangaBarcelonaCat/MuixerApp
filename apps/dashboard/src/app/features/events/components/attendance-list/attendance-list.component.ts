import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  computed,
  inject,
  input,
  output,
  signal,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { NgClass } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_XICALLA } from '../../../../shared/constants/domain-icons';
import { AttendanceService } from '../../services/attendance.service';
import { ToastService } from '../../../../shared/components/feedback/toast/toast.service';
import { AttendanceEditModalComponent } from '../attendance-edit-modal/attendance-edit-modal.component';
import {
  AttendanceItem,
  AttendanceFilterParams,
  AttendanceCrudResponse,
  AttendanceDeleteResponse,
  AttendancePosition,
} from '../../models/attendance.model';
import { AttendanceStatus, AttendanceSummary, getContrastColor, ICON_OBSERVACIONS } from '@muixer/shared';

/**
 * Attendance list of a single event: filters, table (desktop) / cards (mobile),
 * inline status editing and pagination.
 *
 * Lives outside `EventDetailComponent` so the event page can show it in its own
 * tab, isolated from the Pinyes i Figures section.
 */
@Component({
  selector: 'app-attendance-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgClass, FormsModule, LucideAngularModule, AttendanceEditModalComponent],
  templateUrl: './attendance-list.component.html',
})
export class AttendanceListComponent implements OnInit, OnDestroy {
  readonly ICON_XICALLA = ICON_XICALLA;
  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;

  private readonly router = inject(Router);
  private readonly attendanceService = inject(AttendanceService);
  private readonly toast = inject(ToastService);

  readonly AttendanceStatus = AttendanceStatus;
  readonly getContrastColor = getContrastColor;

  eventId = input.required<string>();
  isPast = input(false);

  /** Emitted whenever an edit or delete recalculates the event's attendance summary. */
  summaryChanged = output<AttendanceSummary>();

  loadingAttendance = signal(false);
  attendances = signal<AttendanceItem[]>([]);
  totalAttendances = signal(0);
  attendancePage = signal(1);
  attendanceLimit = signal(100);
  attendanceStatusFilter = signal<AttendanceStatus | undefined>(undefined);
  attendanceSearch = signal('');
  attendanceSearchInput = '';
  private attendanceSearchTimeout: ReturnType<typeof setTimeout> | undefined;

  editingAttendance = signal<AttendanceItem | null>(null);
  confirmedFilterActive = signal(true);
  positionFilter = signal<AttendancePosition | null>(null);

  totalAttendancePages = computed(() =>
    Math.ceil(this.totalAttendances() / this.attendanceLimit()),
  );

  /**
   * Below `lg`, the attendance list renders as cards instead of a table
   * (the table needs ~557px and overflows on mobile). Driven by `matchMedia`;
   * falls back to `false` (table mode) where `matchMedia` is unavailable.
   */
  readonly attendanceCardMode = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 1023.98px)');
      this.attendanceCardMode.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.attendanceCardMode.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }
  }

  ngOnInit() {
    if (this.confirmedFilterActive()) {
      this.attendanceStatusFilter.set(
        this.isPast() ? AttendanceStatus.ASSISTIT : AttendanceStatus.ANIRE,
      );
    }
    this.loadAttendance();
  }

  ngOnDestroy() {
    clearTimeout(this.attendanceSearchTimeout);
  }

  loadAttendance() {
    this.loadingAttendance.set(true);
    const pf = this.positionFilter();
    const filters: AttendanceFilterParams = {
      status: this.attendanceStatusFilter(),
      search: this.attendanceSearch() || undefined,
      positionIds: pf ? [pf.id] : undefined,
      page: this.attendancePage(),
      limit: this.attendanceLimit(),
    };

    this.attendanceService.getByEvent(this.eventId(), filters).subscribe({
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
    this.summaryChanged.emit(result.summary);
    this.editingAttendance.set(null);
    this.toast.success('Assistència actualitzada.');
  }

  onAttendanceDeleted(result: AttendanceDeleteResponse) {
    const deleted = this.editingAttendance();
    this.attendances.update((list) => list.filter((a) => a.id !== deleted?.id));
    this.totalAttendances.update((n) => n - 1);
    this.summaryChanged.emit(result.summary);
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
}
