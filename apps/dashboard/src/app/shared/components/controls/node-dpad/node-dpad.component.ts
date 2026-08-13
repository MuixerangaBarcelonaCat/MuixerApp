import {
  Component,
  ChangeDetectionStrategy,
  input,
  output,
  signal,
  computed,
  OnDestroy,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

export type DpadMode = 'position' | 'size';
export type DpadStep = 1 | 10;

type ArrowDir = 'up' | 'down' | 'left' | 'right';

@Component({
  selector: 'app-node-dpad',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './node-dpad.component.html',
  styleUrl: './node-dpad.component.scss',
})
export class NodeDpadComponent implements OnDestroy {
  disabled = input(false);
  nodeMoved = output<{ dx: number; dy: number }>();
  nodeResized = output<{ dw: number; dh: number }>();

  /** Emitted once when a long-press gesture begins (first pointerdown). */
  holdStarted = output<void>();
  /** Emitted once when the gesture ends (pointerup/cancel/leave). */
  holdEnded = output<void>();

  readonly mode = signal<DpadMode>('position');
  readonly step = signal<DpadStep>(1);

  private repeatTimer: ReturnType<typeof setTimeout> | null = null;
  private repeatInterval: ReturnType<typeof setInterval> | null = null;
  private holding = false;

  readonly modeLabel = computed(() =>
    this.mode() === 'position' ? 'Posició' : 'Mida',
  );

  readonly stepLabel = computed(() => `${this.step()} px`);

  setMode(mode: DpadMode): void {
    this.mode.set(mode);
  }

  toggleStep(): void {
    this.step.update((s) => (s === 1 ? 10 : 1));
  }

  arrowLabel(dir: ArrowDir): string {
    const step = this.step();
    if (this.mode() === 'position') {
      const labels: Record<ArrowDir, string> = {
        up: `Mou amunt ${step} px`,
        down: `Mou avall ${step} px`,
        left: `Mou a l'esquerra ${step} px`,
        right: `Mou a la dreta ${step} px`,
      };
      return labels[dir];
    } else {
      const labels: Record<ArrowDir, string> = {
        up: `Redueix alçada ${step} px`,
        down: `Augmenta alçada ${step} px`,
        left: `Redueix amplada ${step} px`,
        right: `Augmenta amplada ${step} px`,
      };
      return labels[dir];
    }
  }

  onArrowPointerDown(dir: ArrowDir, event: Event): void {
    event.preventDefault();
    if (this.disabled()) return;
    this.holding = true;
    this.holdStarted.emit();
    this.emitForDir(dir);

    this.repeatTimer = setTimeout(() => {
      this.repeatInterval = setInterval(() => {
        this.emitForDir(dir);
      }, 100);
    }, 300);
  }

  onArrowPointerUp(): void {
    if (this.holding) {
      this.holding = false;
      this.holdEnded.emit();
    }
    this.clearRepeat();
  }

  private emitForDir(dir: ArrowDir): void {
    if (this.disabled()) return;
    const s = this.step();
    if (this.mode() === 'position') {
      const deltas: Record<ArrowDir, { dx: number; dy: number }> = {
        up: { dx: 0, dy: -s },
        down: { dx: 0, dy: s },
        left: { dx: -s, dy: 0 },
        right: { dx: s, dy: 0 },
      };
      this.nodeMoved.emit(deltas[dir]);
    } else {
      const deltas: Record<ArrowDir, { dw: number; dh: number }> = {
        up: { dw: 0, dh: -s },
        down: { dw: 0, dh: s },
        left: { dw: -s, dh: 0 },
        right: { dw: s, dh: 0 },
      };
      this.nodeResized.emit(deltas[dir]);
    }
  }

  private clearRepeat(): void {
    if (this.repeatTimer) {
      clearTimeout(this.repeatTimer);
      this.repeatTimer = null;
    }
    if (this.repeatInterval) {
      clearInterval(this.repeatInterval);
      this.repeatInterval = null;
    }
  }

  ngOnDestroy(): void {
    this.clearRepeat();
  }
}
