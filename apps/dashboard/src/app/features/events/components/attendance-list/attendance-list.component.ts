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
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { LucideAngularModule, MessageSquare, MessageSquareText, Search, UserCheck } from 'lucide-angular';
import {
  ButtonComponent,
  ButtonGroupComponent,
  BadgeComponent,
  CardComponent,
  InputComponent,
  SelectComponent,
  ToastService,
  type BadgeVariant,
} from '@muixer/ui';
import { ICON_XICALLA } from '../../../../shared/constants/domain-icons';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceEditModalComponent } from '../attendance-edit-modal/attendance-edit-modal.component';
import {
  AttendanceItem,
  AttendanceFilterParams,
  AttendanceCrudResponse,
} from '../../models/attendance.model';
import { AttendanceStatus, attendanceGroupLabel, attendanceStatusLabel, AttendanceSummary, EventPhase, ICON_OBSERVACIONS, isArrivalPhase } from '@muixer/shared';

/** Order of the statuses in the filter dropdown, with the summary counter each one reads. */
const FILTER_OPTIONS: { status: AttendanceStatus; count: keyof AttendanceSummary }[] = [
  { status: AttendanceStatus.ANIRE, count: 'confirmed' },
  { status: AttendanceStatus.ASSISTIT, count: 'attended' },
  { status: AttendanceStatus.NO_VAIG, count: 'declined' },
  { status: AttendanceStatus.PENDENT, count: 'pending' },
];

/** The API always returns a human Catalan message in the body for 4xx errors; fall back only for network/5xx failures. */
function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse && typeof err.error?.message === 'string') {
    return err.error.message;
  }
  return fallback;
}

/**
 * Attendance list of a single event, built around changing each person's status in one click.
 * Every row carries an inline status control: before the event starts it offers Aniré / No vaig /
 * Pendent; once it has started, Assistit / No presentat / No va anar. Notes live in a small
 * notes-only modal. Table on desktop, cards below `lg`.
 *
 * Lives outside `EventDetailComponent` so the event page can show it in its own tab, isolated
 * from the Pinyes i Figures section.
 */
@Component({
  selector: 'app-attendance-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NgTemplateOutlet,
    FormsModule,
    LucideAngularModule,
    ButtonComponent,
    ButtonGroupComponent,
    BadgeComponent,
    CardComponent,
    InputComponent,
    SelectComponent,
    AttendanceEditModalComponent,
  ],
  templateUrl: './attendance-list.component.html',
})
export class AttendanceListComponent implements OnInit, OnDestroy {
  readonly ICON_XICALLA = ICON_XICALLA;
  readonly UserCheck = UserCheck;
  readonly MessageSquare = MessageSquare;
  readonly MessageSquareText = MessageSquareText;
  readonly ICON_OBSERVACIONS = ICON_OBSERVACIONS;
  readonly SearchIcon = Search;

  private readonly router = inject(Router);
  private readonly attendanceService = inject(AttendanceService);
  private readonly toast = inject(ToastService);

  readonly AttendanceStatus = AttendanceStatus;

  eventId = input.required<string>();
  /** Before the event day: asks; on the day: takes arrivals; after it: read-only badges. */
  phase = input<EventPhase>('before');
  /** The event's attendance summary, for the counts in the filter dropdown. */
  summary = input<AttendanceSummary | null>(null);

  /** Emitted whenever a change recalculates the event's attendance summary. */
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

  /** The attendance whose notes are being edited (notes-only modal). */
  editingAttendance = signal<AttendanceItem | null>(null);

  /**
   * The statuses offered on each row: what is being asked before the event, arrivals on its day.
   * PENDENT is never a button — it is "none selected", reached by clicking the active one again.
   * After the event day there are no buttons: each row shows a read-only badge.
   */
  readonly statusOptions = computed(() =>
    this.phase() === 'day'
      ? [AttendanceStatus.ASSISTIT, AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG]
      : [AttendanceStatus.ANIRE, AttendanceStatus.NO_VAIG],
  );

  readonly readOnly = computed(() => this.phase() === 'after');

  /** Filter dropdown options, each with its count from the event summary. */
  readonly filterOptions = computed(() => {
    const summary = this.summary();
    const withCount = (label: string, count: number | undefined) =>
      count === undefined ? label : `${label} (${count})`;
    return [
      { value: '', label: withCount('Tots', summary?.total) },
      ...FILTER_OPTIONS.map(({ status, count }) => ({
        value: status,
        label: withCount(this.getFilterLabel(status), summary?.[count]),
      })),
    ];
  });

  totalAttendancePages = computed(() =>
    Math.ceil(this.totalAttendances() / this.attendanceLimit()),
  );

  /**
   * Below `lg`, the attendance list renders as cards instead of a table. Driven by `matchMedia`;
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
    this.loadAttendance();
  }

  ngOnDestroy() {
    clearTimeout(this.attendanceSearchTimeout);
  }

  loadAttendance() {
    this.loadingAttendance.set(true);
    const filters: AttendanceFilterParams = {
      status: this.attendanceStatusFilter(),
      search: this.attendanceSearch() || undefined,
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

  /** A search always covers everyone: starting one drops the status filter. */
  onAttendanceSearchChange(value: string) {
    clearTimeout(this.attendanceSearchTimeout);
    this.attendanceSearchTimeout = setTimeout(() => {
      this.attendanceSearch.set(value);
      if (value) this.attendanceStatusFilter.set(undefined);
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

  // --- Attendance changes ---

  /** A status button click: selects that status, or clears it back to PENDENT if it was the active one. */
  toggleStatus(att: AttendanceItem, status: AttendanceStatus) {
    this.setStatus(att, att.status === status ? AttendanceStatus.PENDENT : status);
  }

  /**
   * Sets a person's status in one click. The row updates at once and stays in place (even if it
   * no longer matches the filter) so it doesn't jump away under the cursor; it reverts on error.
   */
  setStatus(att: AttendanceItem, status: AttendanceStatus) {
    if (att.status === status) return;
    const personId = att.person.id;
    this.patchRow(personId, { status });

    this.attendanceService.set(this.eventId(), personId, { status }).subscribe({
      next: (result) => {
        this.replaceRow(result.attendance);
        this.summaryChanged.emit(result.summary);
      },
      error: (err: unknown) => {
        this.patchRow(personId, { status: att.status });
        this.toast.error(errorMessage(err, "No s'ha pogut actualitzar l'assistència"));
      },
    });
  }

  openNotes(att: AttendanceItem) {
    this.editingAttendance.set(att);
  }

  onAttendanceSaved(result: AttendanceCrudResponse) {
    this.replaceRow(result.attendance);
    this.summaryChanged.emit(result.summary);
    this.editingAttendance.set(null);
    this.toast.success("S'han alçat les notes.");
  }

  /** Rows are keyed by person: someone listed as PENDENT may have no attendance row at all. */
  private replaceRow(attendance: AttendanceItem) {
    this.attendances.update((list) =>
      list.map((a) => (a.person.id === attendance.person.id ? attendance : a)),
    );
  }

  private patchRow(personId: string, patch: Partial<AttendanceItem>) {
    this.attendances.update((list) =>
      list.map((a) => (a.person.id === personId ? { ...a, ...patch } : a)),
    );
  }

  navigateToPerson(personId: string): void {
    this.router.navigate(['/persons', personId]);
  }

  /** Tooltip of the status control: when the person last answered. */
  respondedTitle(att: AttendanceItem): string | null {
    return att.respondedAt ? `Resposta: ${this.formatDateTime(att.respondedAt)}` : null;
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
    return attendanceStatusLabel(status, this.phase());
  }

  private getFilterLabel(status: AttendanceStatus): string {
    return attendanceGroupLabel(status, this.phase());
  }

  getStatusBadgeVariant(status: AttendanceStatus): BadgeVariant {
    const arrivals = isArrivalPhase(this.phase());
    const variants: Record<AttendanceStatus, BadgeVariant> = {
      [AttendanceStatus.PENDENT]: 'ghost',
      [AttendanceStatus.ANIRE]: arrivals ? 'warning' : 'success',
      [AttendanceStatus.NO_VAIG]: 'error',
      [AttendanceStatus.ASSISTIT]: 'success',
    };
    return variants[status] ?? 'ghost';
  }

  /** Button variant of a status segment: its colour when selected, neutral otherwise. */
  getStatusButtonVariant(status: AttendanceStatus): 'success' | 'warning' | 'error' | 'neutral' {
    const variant = this.getStatusBadgeVariant(status);
    return variant === 'success' || variant === 'warning' || variant === 'error' ? variant : 'neutral';
  }
}
