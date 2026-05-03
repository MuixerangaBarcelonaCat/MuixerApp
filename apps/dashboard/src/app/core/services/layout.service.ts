import { Injectable, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

/**
 * Servei de layout global. Gestiona el mode de pantalla completa (fullscreen) previst per al mòdul Pinyes (P5).
 * Escolta la tecla Escape per sortir automàticament del mode fullscreen.
 */
@Injectable({ providedIn: 'root' })
export class LayoutService {
  private readonly document = inject(DOCUMENT);

  readonly isFullscreen = signal(false);

  constructor() {
    this.document.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Escape' && this.isFullscreen()) {
        this.exitFullscreen();
      }
    });
  }

  /** Activa el mode pantalla completa. Usat pel mòdul Pinyes per maximitzar el canvas de figures. */
  requestFullscreen(): void {
    this.isFullscreen.set(true);
  }

  /** Desactiva el mode pantalla completa. Cridat automàticament en prémer Escape. */
  exitFullscreen(): void {
    this.isFullscreen.set(false);
  }
}
