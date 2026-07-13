import { Injectable, signal } from '@angular/core';

export type FiguresViewMode = 'pinyes' | 'troncs';

const STORAGE_KEY = 'muixer.pinyes.viewMode';
const VIEW_MODES: FiguresViewMode[] = ['pinyes', 'troncs'];

const isFiguresViewMode = (value: unknown): value is FiguresViewMode =>
  VIEW_MODES.includes(value as FiguresViewMode);

/** Remembers whether the user last looked at pinyes or troncs, shared between the segment list and the workspace. */
@Injectable({ providedIn: 'root' })
export class FiguresViewModeService {
  readonly mode = signal<FiguresViewMode>(this.readStored());

  private readStored(): FiguresViewMode {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isFiguresViewMode(stored) ? stored : 'pinyes';
  }

  set(mode: FiguresViewMode): void {
    this.mode.set(mode);
    localStorage.setItem(STORAGE_KEY, mode);
  }
}
