import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  ElementRef,
  inject,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';
import { EventType, AttendanceStatus, MeEvent } from '@muixer/shared';
import { NgTemplateOutlet } from '@angular/common';
import { LucideAngularModule, ChevronLeft, ChevronRight, Star } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { parseLocalDate } from '../../../../shared/pipes/format-event-date.pipe';
import { memberAttendanceStatus } from '../../../../shared/utils/member-attendance-status.util';

export interface CalendarDay {
  date: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  events: CalendarDayEvent[];
}

export interface CalendarDayEvent {
  id: string;
  eventType: EventType;
  attendanceStatus: AttendanceStatus | null;
}

interface DayHeader {
  short: string;
  full: string;
}

const DAY_HEADERS: DayHeader[] = [
  { short: 'Dl', full: 'Dilluns' },
  { short: 'Dt', full: 'Dimarts' },
  { short: 'Dc', full: 'Dimecres' },
  { short: 'Dj', full: 'Dijous' },
  { short: 'Dv', full: 'Divendres' },
  { short: 'Ds', full: 'Dissabte' },
  { short: 'Dg', full: 'Diumenge' },
];

const MONTH_FORMATTER = new Intl.DateTimeFormat('ca', {
  month: 'long',
  year: 'numeric',
});

const DAY_LABEL_FORMATTER = new Intl.DateTimeFormat('ca', {
  day: 'numeric',
  month: 'long',
});

const ATTENDANCE_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.ANIRE]: 'Vaig',
  [AttendanceStatus.NO_VAIG]: 'No vaig',
  [AttendanceStatus.PENDENT]: 'Pendent',
  [AttendanceStatus.ASSISTIT]: 'He assistit',
};

// Color depends only on the attendance answer, not the event type — a will-attend/attended
// event reads as "good" (success), a declined one as "gone" (error), and an unanswered one is
// left empty/outline in the neutral primary hue. Shape is what carries the event type instead
// (circle for assaig, star for actuació — see `dotClasses`/`starClasses` below).
// Color is never the only cue: a declined marker is also drawn as an outline with a slash
// through it, so «Vaig» (solid) and «No vaig» (struck) stay apart for colorblind members.
type AttendanceBucket = 'positive' | 'negative' | 'pending';

// `neutral` is the legend's event-type key — no attendance answer attached.
type MarkerTone = AttendanceBucket | 'neutral';

interface LegendItem {
  label: string;
  eventType: EventType;
  tone: MarkerTone;
}

const LEGEND: LegendItem[] = [
  { label: 'Vaig', eventType: EventType.ASSAIG, tone: 'positive' },
  { label: 'No vaig', eventType: EventType.ASSAIG, tone: 'negative' },
  { label: 'Pendent', eventType: EventType.ASSAIG, tone: 'pending' },
  { label: 'Assaig', eventType: EventType.ASSAIG, tone: 'neutral' },
  { label: 'Actuació', eventType: EventType.ACTUACIO, tone: 'neutral' },
];

const BUCKET_BY_STATUS: Record<AttendanceStatus, AttendanceBucket> = {
  [AttendanceStatus.ANIRE]: 'positive',
  [AttendanceStatus.ASSISTIT]: 'positive',
  [AttendanceStatus.NO_VAIG]: 'negative',
  [AttendanceStatus.PENDENT]: 'pending',
};

const DOT_CLASSES: Record<MarkerTone, string> = {
  positive: 'bg-success',
  negative: 'border border-error',
  pending: 'border border-primary',
  neutral: 'bg-base-content/60',
};

// `fill-*`/`text-*` land on the icon's own generated <svg> (see LucideAngularComponent's `class`
// input), overriding its hardcoded `fill="none"` presentation attribute — a plain CSS class binds
// with normal cascade precedence, which beats a presentation attribute regardless of DOM order.
const STAR_CLASSES: Record<MarkerTone, string> = {
  positive: 'text-success fill-success',
  negative: 'text-error',
  pending: 'text-primary',
  neutral: 'text-base-content/60 fill-base-content/60',
};

const SWIPE_THRESHOLD = 50;

@Component({
  selector: 'app-calendar-view',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent, NgTemplateOutlet],
  templateUrl: './calendar-view.component.html',
})
export class CalendarViewComponent implements AfterViewInit, OnDestroy {
  readonly events = input.required<MeEvent[]>();
  readonly selectedDate = input<string | null>(null);
  readonly selectedDateChange = output<string | null>();

  protected readonly ChevronLeft = ChevronLeft;
  protected readonly ChevronRight = ChevronRight;
  protected readonly Star = Star;
  protected readonly EventType = EventType;
  protected readonly dayHeaders = DAY_HEADERS;
  protected readonly legend = LEGEND;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private touchStartX = 0;
  private touchStartY = 0;

  protected readonly currentMonth = signal({
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });

  protected readonly focusedDate = signal(this.todayStr());

  protected readonly monthLabel = computed(() => {
    const { year, month } = this.currentMonth();
    const date = new Date(year, month, 1);
    const label = MONTH_FORMATTER.format(date);
    return label.charAt(0).toUpperCase() + label.slice(1);
  });

  protected readonly calendarGrid = computed(() => {
    const { year, month } = this.currentMonth();
    return this.buildMonthGrid(year, month, this.events());
  });

  private readonly touchStartFn = (e: TouchEvent) => {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  };

  private readonly touchEndFn = (e: TouchEvent) => {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    if (Math.abs(dx) >= SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy) * 1.5) {
      this.zone.run(() => {
        if (dx < 0) this.nextMonth();
        else this.previousMonth();
      });
    }
  };

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      el.addEventListener('touchstart', this.touchStartFn, { passive: true });
      el.addEventListener('touchend', this.touchEndFn, { passive: true });
    });
  }

  ngOnDestroy(): void {
    const el = this.el.nativeElement;
    el.removeEventListener('touchstart', this.touchStartFn);
    el.removeEventListener('touchend', this.touchEndFn);
  }

  previousMonth(): void {
    const { year, month } = this.currentMonth();
    this.currentMonth.set(
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
    this.selectedDateChange.emit(null);
  }

  nextMonth(): void {
    const { year, month } = this.currentMonth();
    this.currentMonth.set(
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
    this.selectedDateChange.emit(null);
  }

  selectDay(day: CalendarDay): void {
    if (!day.isCurrentMonth) return;
    const newDate = this.selectedDate() === day.date ? null : day.date;
    this.selectedDateChange.emit(newDate);
  }

  bucketFor(ev: CalendarDayEvent): AttendanceBucket {
    return ev.attendanceStatus == null ? 'pending' : BUCKET_BY_STATUS[ev.attendanceStatus];
  }

  dotClasses(tone: MarkerTone): string {
    return DOT_CLASSES[tone];
  }

  starClasses(tone: MarkerTone): string {
    return STAR_CLASSES[tone];
  }

  onDayKeydown(event: KeyboardEvent, day: CalendarDay): void {
    const date = parseLocalDate(day.date);
    if (!date) return;
    let target: Date | null = null;

    switch (event.key) {
      case 'ArrowRight': target = this.addDays(date, 1); break;
      case 'ArrowLeft': target = this.addDays(date, -1); break;
      case 'ArrowDown': target = this.addDays(date, 7); break;
      case 'ArrowUp': target = this.addDays(date, -7); break;
      case 'Home': target = new Date(date.getFullYear(), date.getMonth(), 1); break;
      case 'End': target = new Date(date.getFullYear(), date.getMonth() + 1, 0); break;
      case 'Enter':
      case ' ':
        this.selectDay(day);
        event.preventDefault();
        return;
      default: return;
    }
    event.preventDefault();
    if (!target) return;

    const targetMonth = target.getMonth();
    const targetYear = target.getFullYear();
    const { year, month } = this.currentMonth();
    if (targetMonth !== month || targetYear !== year) {
      this.currentMonth.set({ year: targetYear, month: targetMonth });
    }
    const targetDateStr = this.formatDate(target);
    this.focusedDate.set(targetDateStr);
    queueMicrotask(() => {
      const el = this.el.nativeElement.querySelector(
        `[data-date="${targetDateStr}"]`,
      ) as HTMLElement | null;
      el?.focus();
    });
  }

  dayAriaLabel(day: CalendarDay): string {
    const date = parseLocalDate(day.date);
    if (!date) return '';
    const dateLabel = DAY_LABEL_FORMATTER.format(date);
    if (day.events.length === 0) return dateLabel;

    const eventDescs = day.events.map((ev) => {
      const type = ev.eventType === EventType.ASSAIG ? 'Assaig' : 'Actuació';
      const status = ev.attendanceStatus ? ATTENDANCE_LABELS[ev.attendanceStatus] : 'Pendent';
      return `${type}, ${status}`;
    });
    return `${dateLabel}, ${eventDescs.join('; ')}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private buildMonthGrid(year: number, month: number, events: MeEvent[]): CalendarDay[][] {
    const today = this.todayStr();
    const firstDay = new Date(year, month, 1);
    const startDayOfWeek = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startDayOfWeek);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const totalCells = startDayOfWeek + daysInMonth;
    const weekCount = Math.ceil(totalCells / 7);

    const eventsByDate = new Map<string, CalendarDayEvent[]>();
    for (const e of events) {
      const existing = eventsByDate.get(e.date) ?? [];
      existing.push({
        id: e.id,
        eventType: e.eventType,
        attendanceStatus: memberAttendanceStatus(e.myAttendance?.status),
      });
      eventsByDate.set(e.date, existing);
    }

    const weeks: CalendarDay[][] = [];
    const current = new Date(startDate);

    for (let w = 0; w < weekCount; w++) {
      const week: CalendarDay[] = [];
      for (let d = 0; d < 7; d++) {
        const dateStr = this.formatDate(current);
        week.push({
          date: dateStr,
          dayNumber: current.getDate(),
          isCurrentMonth: current.getMonth() === month && current.getFullYear() === year,
          isToday: dateStr === today,
          events: eventsByDate.get(dateStr) ?? [],
        });
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    return weeks;
  }

  private formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private todayStr(): string {
    return this.formatDate(new Date());
  }
}
