import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class CanvasStateService {
  readonly gridEnabled = signal<boolean>(true);
  readonly gridSpacing = signal<number>(40);
  readonly snapToGrid = signal<boolean>(true);

  reset(): void {}
}
