import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  Layers,
  PlusCircle,
  UserCheck,
  HelpCircle,
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
  imports: [LucideAngularModule],
  templateUrl: './pinyes-onboarding-modal.component.html',
})
export class PinyesOnboardingModalComponent {
  readonly closed = output<void>();
  readonly X = X;

  readonly steps: OnboardingStep[] = [
    {
      title: 'Famílies i variants',
      description:
        'Una família agrupa les variants d\'una mateixa figura. ' +
        'Cada variant té un nombre diferent de cordons. ' +
        'Per exemple, "Pilar de 4" pot tenir variants amb 1, 2 o 3 cordons.',
      icon: Layers,
    },
    {
      title: 'Cordons',
      description:
        'Quan una figura necessita més gent, s\'afegeix un cordó. ' +
        'Les posicions existents i les assignacions es mantenen intactes. ' +
        'Només s\'afegeixen les posicions noves del següent cordó.',
      icon: PlusCircle,
    },
    {
      title: 'Assignacions',
      description:
        'Les assignacions es fan sobre una còpia de la figura (snapshot). ' +
        'Editar el template original no afecta les assignacions existents. ' +
        'Pots importar assignacions de pinyes anteriors per estalviar temps.',
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
