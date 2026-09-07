import { Directive, ElementRef, NgZone, OnDestroy, effect, inject, input, output, afterNextRender } from '@angular/core';

/**
 * Emits `visible` when the host element scrolls into view — drop it on a sentinel at the
 * bottom of a list to trigger loading the next page. Bind `appInfiniteScrollDisabled` while a
 * page is already loading or there's nothing left to load, so a sentinel that never leaves the
 * viewport (short list, tall screen) doesn't fire repeatedly.
 *
 * Re-checks intersection whenever `disabled` turns back to `false`: the observer only fires on a
 * ratio *change*, so if the sentinel is still on screen once loading finishes it would otherwise
 * stay silent until the next scroll — this keeps a short trailing page loading itself out.
 */
@Directive({
  selector: '[appInfiniteScroll]',
})
export class InfiniteScrollDirective implements OnDestroy {
  readonly disabled = input(false, { alias: 'appInfiniteScrollDisabled' });
  readonly visible = output<void>();

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.setup());

    effect(() => {
      if (!this.disabled()) {
        this.observer?.unobserve(this.el.nativeElement);
        this.observer?.observe(this.el.nativeElement);
      }
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  private setup(): void {
    // Not available in every test/SSR environment — infinite scroll is a progressive
    // enhancement there, real browsers all support it.
    if (typeof IntersectionObserver === 'undefined') return;

    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && !this.disabled()) {
            this.zone.run(() => this.visible.emit());
          }
        },
        { rootMargin: '200px' },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }
}
