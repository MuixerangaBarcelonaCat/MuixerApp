import { Injectable, signal } from '@angular/core';

/**
 * Global layout state. Fullscreen (segment projection) hides the bottom tab bar and the
 * app shell's chrome. Components that request fullscreen are responsible for exiting it
 * in their own lifecycle (ngOnDestroy).
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  readonly isFullscreen = signal(false);

  requestFullscreen(): void {
    this.isFullscreen.set(true);
  }

  exitFullscreen(): void {
    this.isFullscreen.set(false);
  }
}
