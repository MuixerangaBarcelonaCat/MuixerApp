import {
  Component,
  ChangeDetectionStrategy,
  DestroyRef,
  signal,
  inject,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { AttendanceService } from '../../services/attendance.service';
import { AttendanceItem } from '../../models/attendance.model';
import { AttendanceStatus } from '@muixer/shared';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', 'Ç'],
  ['', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', '⌫', ''],
];

@Component({
  selector: 'app-attendance-confirmation',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './attendance-confirmation.component.html',
})
export class AttendanceConfirmationComponent implements OnInit, OnDestroy {
  private readonly attendanceService = inject(AttendanceService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly KEYBOARD_ROWS = KEYBOARD_ROWS;
  readonly AttendanceStatus = AttendanceStatus;

  private eventId = '';
  private searchSub?: Subscription;

  query = signal('');
  results = signal<AttendanceItem[]>([]);
  total = signal(0);
  loading = signal(true);
  confirmingId = signal<string | null>(null);
  recentlyConfirmed = signal<string | null>(null);

  /**
   * The kiosk-style keypad (10 keys sized off 60vw) can't shrink below the
   * WCAG tap-target minimum on a phone-width screen (WI-21, ~13px/key at
   * 393px). Shows a guard message instead, same `matchMedia` pattern as
   * WI-10/WI-13. Falls back to `false` where `matchMedia` is unavailable.
   */
  readonly mobileUnsupported = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(max-width: 639.98px)');
      this.mobileUnsupported.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.mobileUnsupported.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }
  }

  ngOnInit() {
    this.eventId = this.route.snapshot.paramMap.get('id') ?? '';
    this.loadResults();
  }

  ngOnDestroy() {
    this.searchSub?.unsubscribe();
  }

  onKey(key: string) {
    if (key === '⌫') {
      this.query.update((q) => q.slice(0, -1));
    } else {
      this.query.update((q) => q + key);
    }
    this.loadResults();
  }

  private loadResults() {
    const q = this.query();
    if (q.length < 2) {
      this.searchSub?.unsubscribe();
      this.results.set([]);
      this.loading.set(false);
      return;
    }
    this.searchSub?.unsubscribe();
    this.loading.set(true);
    this.searchSub = this.attendanceService
      .getByEvent(this.eventId, { search: q, limit: 100 })
      .subscribe({
        next: (resp) => {
          this.results.set(resp.data.filter((a) => a.status !== AttendanceStatus.ASSISTIT));
          this.total.set(resp.meta.total);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  confirm(att: AttendanceItem) {
    if (this.confirmingId()) return;
    this.confirmingId.set(att.id);

    this.attendanceService
      .update(this.eventId, att.id, { status: AttendanceStatus.ASSISTIT })
      .subscribe({
        next: () => {
          this.recentlyConfirmed.set(att.person.alias);
          this.confirmingId.set(null);
          this.query.set('');
          this.loadResults();
          setTimeout(() => this.recentlyConfirmed.set(null), 2500);
        },
        error: () => this.confirmingId.set(null),
      });
  }

  goBack() {
    this.router.navigate(['..'], { relativeTo: this.route });
  }
}
