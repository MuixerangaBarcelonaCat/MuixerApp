import { Injectable, signal, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

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

  requestFullscreen(): void {
    this.isFullscreen.set(true);
  }

  exitFullscreen(): void {
    this.isFullscreen.set(false);
  }
}
