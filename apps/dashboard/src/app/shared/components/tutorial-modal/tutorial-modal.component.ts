import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule, X } from 'lucide-angular';
import { TutorialStep } from './tutorial-step.model';

/**
 * Generic multi-step, dismissible tutorial modal. Two modes, chosen by whether `storageKey`
 * is supplied:
 * - With `storageKey`: self-managed first-visit tutorial — auto-shows unless previously
 *   dismissed, and offers a "no tornes a mostrar" checkbox that persists to that key.
 * - Without `storageKey`: purely parent-controlled — starts hidden, no checkbox, shown only
 *   via the public `open()` method (e.g. triggered right after some other action completes).
 */
@Component({
  selector: 'app-tutorial-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './tutorial-modal.component.html',
})
export class TutorialModalComponent implements OnInit {
  readonly steps = input.required<TutorialStep[]>();
  readonly heading = input.required<string>();
  readonly storageKey = input<string>();

  readonly closed = output<void>();
  readonly X = X;

  readonly currentStep = signal(0);
  readonly dontShowAgain = signal(false);
  readonly visible = signal(false);

  ngOnInit(): void {
    const key = this.storageKey();
    if (key && localStorage.getItem(key) !== 'true') {
      this.visible.set(true);
    }
  }

  open(): void {
    this.currentStep.set(0);
    this.dontShowAgain.set(false);
    this.visible.set(true);
  }

  nextStep(): void {
    if (this.currentStep() < this.steps().length - 1) {
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
    }
  }

  close(): void {
    const key = this.storageKey();
    if (key && this.dontShowAgain()) {
      localStorage.setItem(key, 'true');
    }
    this.visible.set(false);
    this.closed.emit();
  }

  toggleDontShowAgain(): void {
    this.dontShowAgain.update((v) => !v);
  }
}
