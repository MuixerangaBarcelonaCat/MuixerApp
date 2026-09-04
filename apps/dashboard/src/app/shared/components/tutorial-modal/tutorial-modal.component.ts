import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  input,
  output,
  signal,
} from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, CheckboxComponent, ModalComponent } from '@muixer/ui';
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
  imports: [LucideAngularModule, FormsModule, ButtonComponent, CheckboxComponent, ModalComponent],
  templateUrl: './tutorial-modal.component.html',
})
export class TutorialModalComponent implements OnInit {
  readonly steps = input.required<TutorialStep[]>();
  readonly heading = input.required<string>();
  readonly storageKey = input<string>();

  readonly closed = output<void>();

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

  // lib-modal's own `closed` output fires for every dismissal path (X button, Escape, backdrop,
  // or `open` simply flipping to false) — including the one *this* component already handled by
  // calling close() itself (e.g. the in-content "Entesos!" button), which cascades into the same
  // native dialog close event once lib-modal's effect reacts to `visible` going false. Only run
  // the shared close logic here if close() didn't already run it, or a natively-triggered
  // dismissal (X/Escape/backdrop) would never update state, and an app-triggered one would
  // double-emit the public `closed` output.
  onModalDismissed(): void {
    if (this.visible()) {
      this.close();
    }
  }

  toggleDontShowAgain(): void {
    this.dontShowAgain.update((v) => !v);
  }
}
