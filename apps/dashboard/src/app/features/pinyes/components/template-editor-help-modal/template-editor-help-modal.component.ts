import {
  ChangeDetectionStrategy,
  Component,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import {
  LucideAngularModule,
  BookOpen,
  ArrowUpDown,
  RotateCcw,
} from 'lucide-angular';

const STORAGE_KEY = 'muixer_template_editor_help_dismissed';

interface HelpStep {
  title: string;
  description: string;
  icon: typeof BookOpen;
  hasDiagram?: boolean;
}

@Component({
  selector: 'app-template-editor-help-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './template-editor-help-modal.component.html',
})
export class TemplateEditorHelpModalComponent implements OnInit {
  readonly closed = output<void>();

  /** When true (default), auto-shows the modal on init if not previously dismissed. */
  readonly autoShow = input(true);

  readonly BookOpen = BookOpen;
  readonly ArrowUpDown = ArrowUpDown;
  readonly RotateCcw = RotateCcw;

  readonly steps: HelpStep[] = [
    {
      title: "Com funciona l'editor",
      description:
        "L'editor et permet dissenyar la figura afegint Bases (intersecció pinya-tronc) i posicions de Pinya des de la barra d'eines. " +
        'El Tronc (pisos sobre les Bases) es gestiona des del panell flotant "Tronc".',
      icon: BookOpen,
    },
    {
      title: 'Ordre de les Bases',
      description:
        "Les Bases s'han de numerar d'esquerra a dreta seguint l'ordre anti-horari (comenzant per la dalt-esquerra). " +
        "Exemple per a 4 Bases: Base 1 = dalt-esquerra, Base 2 = baix-esquerra, Base 3 = baix-dreta, Base 4 = dalt-dreta. " +
        "Aquest ordre és fonamental perquè els Segons, Terços i altres posicions del Tronc quedin alineats correctament sobre les Bases.",
      icon: RotateCcw,
      hasDiagram: true,
    },
    {
      title: 'Tronc i pisos',
      description:
        "El Tronc és compartit per totes les variants d'una família. Cada pis del Tronc (P2, P3...) s'alinea sobre les Bases de P1. " +
        'Si les Bases no estan en ordre anti-horari correcte, el mòdul de tronc no podrà col·locar correctament les persones sobre les Bases adequades.',
      icon: ArrowUpDown,
    },
  ];

  readonly currentStep = signal(0);
  readonly dontShowAgain = signal(false);
  readonly visible = signal(false);

  constructor() {}

  ngOnInit(): void {
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed !== 'true' && this.autoShow()) {
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
