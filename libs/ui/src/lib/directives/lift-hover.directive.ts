import { Directive, ElementRef, HostBinding, HostListener, NgZone, OnDestroy, inject, signal } from '@angular/core';

// Companion to the shared `.ds-lift` motion (libs/ui/src/styles/_interactive.scss). Native
// `:hover` can't drive the lift transform directly: `.ds-lift` both triggers hover AND moves on
// hover, so translateY(-3px) shifts the element's own hit-box. A cursor resting near the bottom
// edge then oscillates forever — lift moves the box away from the cursor, hover drops, the box
// falls back onto the cursor, hover fires again, repeat.
//
// This directive breaks that loop by deciding "still hovering" from the element's RESTING
// (pre-transform) rect, captured once on mouseenter, rather than from the live (possibly lifted)
// box the browser re-hit-tests on every native hover/leave event. It tracks the real cursor via a
// document-level `mousemove` (the only way to keep receiving coordinates once the transformed box
// has moved out from under the pointer — the element itself stops receiving events at that point)
// and only clears `ds-lift-hovering` once the cursor truly leaves that stable rect. `_interactive
// .scss` keys the lift transform off this class instead of `:hover`.
@Directive({
  selector: '[libDsLift]',
})
export class LiftHoverDirective implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);

  private restRect: DOMRect | null = null;
  private moveListener: ((event: MouseEvent) => void) | null = null;

  // A signal, not a plain field: `stop()` below is invoked from a raw `document.addEventListener`
  // callback (run outside Angular's zone for perf — see onEnter), so a plain field mutation
  // wrapped in `zone.run()` isn't enough to refresh an OnPush host — re-entering the zone
  // schedules a global tick, but Angular still skips an OnPush view that isn't itself marked
  // dirty, and nothing here does that. A signal write schedules change detection for whatever
  // reads it regardless of zone/OnPush dirty-marking, so the class binding below actually flushes.
  private readonly hoveringState = signal(false);

  @HostBinding('class.ds-lift-hovering')
  get hovering(): boolean {
    return this.hoveringState();
  }

  @HostListener('mouseenter')
  onEnter(): void {
    if (this.hoveringState()) return;
    this.restRect = this.el.nativeElement.getBoundingClientRect();
    this.hoveringState.set(true);
    this.zone.runOutsideAngular(() => {
      this.moveListener = (event: MouseEvent) => this.checkStillInside(event);
      document.addEventListener('mousemove', this.moveListener);
    });
  }

  // Fallback for the cases `mousemove` can miss (e.g. the pointer leaves via a touch/keyboard
  // path, or the window loses focus) — re-checked against the same stable rect, never trusted
  // blindly, so it can't reintroduce the flicker it's meant to guard against.
  @HostListener('mouseleave', ['$event'])
  onLeave(event: MouseEvent): void {
    this.checkStillInside(event);
  }

  private checkStillInside(event: MouseEvent): void {
    const rect = this.restRect;
    if (!rect) return;
    const inside =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inside) this.stop();
  }

  private stop(): void {
    this.restRect = null;
    if (this.moveListener) {
      document.removeEventListener('mousemove', this.moveListener);
      this.moveListener = null;
    }
    this.hoveringState.set(false);
  }

  ngOnDestroy(): void {
    this.stop();
  }
}
