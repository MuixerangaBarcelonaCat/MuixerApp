import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import { CdkTrapFocus } from '@angular/cdk/a11y';
import {
  LucideAngularModule,
  Layers,
  GitCommitHorizontal,
  UserCheck,
  X,
} from 'lucide-angular';

const STORAGE_KEY = 'muixer_pinyes_onboarding_dismissed';

interface OnboardingStep {
  title: string;
  description: string;
  icon: typeof Layers;
}

@Component({
  selector: 'app-pinyes-onboarding-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, CdkTrapFocus],
  templateUrl: './pinyes-onboarding-modal.component.html',
})
export class PinyesOnboardingModalComponent {
  readonly closed = output<void>();
  readonly X = X;

  readonly steps: OnboardingStep[] = [
    {
      title: 'Famílies i figures',
      description:
        'Cada família agrupa la informació d\'una figura (ex: "Pinet doble"). ' +
        'Un sol template conté totes les posicions de tots els cordons. ' +
        'Les rengles defineixen les línies radials de posicions del centre cap enfora.',
      icon: Layers,
    },
    {
      title: 'Rengles i cordons',
      description:
        'Una rengla és la línia de posicions des del centre de la pinya cap al cordó extern. ' +
        'A l\'assignació, el selector de cordons controla quants cordons es mostren. ' +
        'Canviar el nombre de cordons no elimina assignacions — només les amaga o mostra.',
      icon: GitCommitHorizontal,
    },
    {
      title: 'Assignacions',
      description:
        'Les assignacions es fan sobre una còpia de la figura (snapshot). ' +
        'Editar el template original no afecta les assignacions existents. ' +
        'Pots importar assignacions de pinyes anteriors i configurar cordons per instància.',
      icon: UserCheck,
    },
  ];

  readonly currentStep = signal(0);
  readonly dontShowAgain = signal(false);
  readonly visible = signal(false);

  constructor() {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== 'true') {
      this.visible.set(true);
    }
  }

  open(): void {
    this.currentStep.set(0);
    this.dontShowAgain.set(false);
    this.visible.set(true);
  }

  nextStep(): void {
    if (this.currentStep() < this.steps.length - 1) {
      this.currentStep.update((s) => s + 1);
    }
  }

  prevStep(): void {
    if (this.currentStep() > 0) {
      this.currentStep.update((s) => s - 1);
    }
  }

  close(): void {
    if (this.dontShowAgain()) {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
    this.visible.set(false);
    this.closed.emit();
  }

  toggleDontShowAgain(): void {
    this.dontShowAgain.update((v) => !v);
  }
}
