import { Injectable, signal } from '@angular/core';

/**
 * Servei de layout global. Gestiona el mode de pantalla completa (fullscreen) previst per al mòdul Pinyes (P5).
 * Components that use fullscreen are responsible for calling exitFullscreen() in their own lifecycle (ngOnDestroy).
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
