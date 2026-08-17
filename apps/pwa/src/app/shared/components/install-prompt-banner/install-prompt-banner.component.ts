import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { LucideAngularModule, Download, Share, X } from 'lucide-angular';
import { InstallPromptService } from '../../services/install-prompt.service';

@Component({
  selector: 'app-install-prompt-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="alert alert-info shadow-sm mb-4 items-start" role="alert">
      @if (installPrompt.isIos) {
        <lucide-icon [img]="Share" [size]="20" />
        <div>
          <p class="font-medium">Instal·la l'app</p>
          <p class="text-sm">
            Toca <strong>Compartir</strong> i després
            <strong>"Afegeix a l'inici"</strong> per tenir Muixer com una app.
          </p>
        </div>
      } @else {
        <lucide-icon [img]="Download" [size]="20" />
        <div class="flex-1">
          <p class="font-medium">Instal·la l'app</p>
          <p class="text-sm">Afegeix Muixer a la pantalla d'inici del mòbil.</p>
        </div>
        <button type="button" class="btn btn-sm btn-primary" (click)="installPrompt.promptInstall()">
          Instal·la
        </button>
      }
      <button
        type="button"
        class="btn btn-sm btn-ghost btn-square"
        aria-label="Tanca"
        (click)="installPrompt.dismiss()"
      >
        <lucide-icon [img]="X" [size]="16" />
      </button>
    </div>
  `,
})
export class InstallPromptBannerComponent {
  protected readonly installPrompt = inject(InstallPromptService);
  protected readonly Download = Download;
  protected readonly Share = Share;
  protected readonly X = X;
}
