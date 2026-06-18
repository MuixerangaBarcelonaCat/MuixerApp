import {
  Component,
  ChangeDetectionStrategy,
  output,
  signal,
  ElementRef,
  inject,
  AfterViewInit,
  OnDestroy,
  NgZone,
} from '@angular/core';

@Component({
  selector: 'app-pull-to-refresh',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (isPulling() || isRefreshing()) {
      <div
        class="flex justify-center py-2 transition-opacity"
        [class.opacity-50]="isPulling() && !isRefreshing()"
        role="status"
        aria-live="polite"
      >
        <span class="loading loading-spinner loading-sm text-primary"></span>
        @if (isRefreshing()) {
          <span class="ml-2 text-sm text-base-content/60">Actualitzant…</span>
        }
      </div>
    }
    <ng-content />
  `,
})
export class PullToRefreshComponent implements AfterViewInit, OnDestroy {
  readonly refresh = output<void>();
  protected readonly isPulling = signal(false);
  protected readonly isRefreshing = signal(false);

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private startY = 0;
  private pulling = false;

  private touchStartFn = (e: TouchEvent) => this.onTouchStart(e);
  private touchMoveFn = (e: TouchEvent) => this.onTouchMove(e);
  private touchEndFn = () => this.onTouchEnd();

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      const el = this.el.nativeElement;
      el.addEventListener('touchstart', this.touchStartFn, { passive: true });
      el.addEventListener('touchmove', this.touchMoveFn, { passive: true });
      el.addEventListener('touchend', this.touchEndFn, { passive: true });
    });
  }

  ngOnDestroy(): void {
    const el = this.el.nativeElement;
    el.removeEventListener('touchstart', this.touchStartFn);
    el.removeEventListener('touchmove', this.touchMoveFn);
    el.removeEventListener('touchend', this.touchEndFn);
  }

  complete(): void {
    this.isRefreshing.set(false);
    this.isPulling.set(false);
  }

  private onTouchStart(e: TouchEvent): void {
    if (window.scrollY === 0) {
      this.startY = e.touches[0].clientY;
      this.pulling = true;
    }
  }

  private onTouchMove(e: TouchEvent): void {
    if (!this.pulling) return;
    const dy = e.touches[0].clientY - this.startY;
    if (dy > 10) {
      this.zone.run(() => this.isPulling.set(true));
    }
  }

  private onTouchEnd(): void {
    if (!this.pulling) return;
    this.pulling = false;

    if (this.isPulling() && !this.isRefreshing()) {
      this.zone.run(() => {
        this.isRefreshing.set(true);
        this.refresh.emit();
      });
    } else {
      this.zone.run(() => this.isPulling.set(false));
    }
  }
}
