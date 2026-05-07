import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CanvasStateService {
  readonly zoom = signal<number>(1);
  readonly panOffset = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly selectedNodeId = signal<string | null>(null);
  readonly gridEnabled = signal<boolean>(true);
  readonly gridSpacing = signal<number>(40);
  readonly troncVisible = signal<boolean>(true);

  reset(): void {
    this.zoom.set(1);
    this.panOffset.set({ x: 0, y: 0 });
    this.selectedNodeId.set(null);
  }
}
