import { DestroyRef, Injectable, inject, signal } from '@angular/core';

/**
 * Servei de layout global. Gestiona el mode de pantalla completa (fullscreen) previst per al mòdul Pinyes (P5).
 * Components that use fullscreen are responsible for calling exitFullscreen() in their own lifecycle (ngOnDestroy).
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isFullscreen = signal(false);

  /**
   * Whether the primary input is a touchscreen (phone / tablet). Follows the primary pointer
   * (`pointer: coarse`) rather than the viewport width or any-touch capability, so a touch
   * laptop driven by a mouse keeps the desktop layout. `false` where `matchMedia` is unavailable.
   */
  readonly isTouch = signal(false);

  constructor() {
    if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
      const mql = window.matchMedia('(pointer: coarse)');
      this.isTouch.set(mql.matches);
      const listener = (e: MediaQueryListEvent) => this.isTouch.set(e.matches);
      mql.addEventListener('change', listener);
      inject(DestroyRef).onDestroy(() => mql.removeEventListener('change', listener));
    }
  }

  requestFullscreen(): void {
    this.isFullscreen.set(true);
  }

  exitFullscreen(): void {
    this.isFullscreen.set(false);
  }
}
