import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  UserCheck,
  X,
} from 'lucide-angular';
import { DOMAIN_ICONS } from '../../../../shared/constants/domain-icons';

const STORAGE_KEY = 'muixer_pinyes_onboarding_dismissed';

interface OnboardingStep {
  title: string;
  description: string;
  icon: typeof DOMAIN_ICONS.FIGURA;
}

@Component({
  selector: 'app-pinyes-onboarding-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './pinyes-onboarding-modal.component.html',
})
export class PinyesOnboardingModalComponent {
  readonly closed = output<void>();
  readonly X = X;

  readonly steps: OnboardingStep[] = [
    {
      title: 'Figures',
      description:
        'Cada figura defineix totes les posicions de tots els cordons (ex: "Pinet doble de 4"). ' +
        'Les rengles defineixen les línies radials de posicions del centre cap enfora.',
      icon: DOMAIN_ICONS.FIGURA,
    },
    {
      title: 'Rengles',
      description:
        'Una rengla és la línia de posicions des del centre de la pinya cap enfora. ' +
        'Cada posició dins la rengla correspon a un cordó diferent (1r, 2n, 3r...).',
      icon: DOMAIN_ICONS.RENGLA,
    },
    {
      title: 'Assignacions',
      description:
        'Les assignacions es fan sobre una còpia de la figura (snapshot). ' +
        'Editar el template original no afecta les assignacions existents. ' +
        'Pots importar assignacions de pinyes anteriors.',
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
