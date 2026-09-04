import { DestroyRef, Injectable, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { LayoutService } from './layout.service';

/**
 * Suppresses browser pinch-to-zoom and double-tap-zoom so the PWA feels like an app, not a
 * web page. CSS `touch-action` (see styles.scss) covers Chromium/Firefox; iOS Safari ignores
 * it for page zoom and needs `preventDefault()` on the `gesture*` events plus multi-touch
 * `touchmove`.
 *
 * The segment projection screen is exempt: it renders a Konva canvas that implements its own
 * pinch-zoom, and `LayoutService.isFullscreen()` is true only while it is open.
 */
@Injectable({ providedIn: 'root' })
export class PinchZoomGuardService {
  private readonly document = inject(DOCUMENT);
  private readonly layout = inject(LayoutService);
  private readonly destroyRef = inject(DestroyRef);
  private installed = false;

  install(): void {
    if (this.installed) return;
    this.installed = true;

    const block = (event: Event): void => {
      if (!this.layout.isFullscreen()) event.preventDefault();
    };

    const touchBlock = (event: TouchEvent): void => {
      if (event.touches.length > 1 && !this.layout.isFullscreen()) event.preventDefault();
    };

    // iOS Safari pinch gesture
    const gestureTypes = ['gesturestart', 'gesturechange', 'gestureend'];
    for (const type of gestureTypes) {
      this.document.addEventListener(type, block, { passive: false });
    }

    // Fallback for engines that let a multi-finger pinch slip past `touch-action`
    this.document.addEventListener('touchmove', touchBlock, { passive: false });

    // Detach on injector teardown so tests don't leak listeners onto a shared document.
    this.destroyRef.onDestroy(() => {
      for (const type of gestureTypes) {
        this.document.removeEventListener(type, block);
      }
      this.document.removeEventListener('touchmove', touchBlock);
      this.installed = false;
    });
  }
}
