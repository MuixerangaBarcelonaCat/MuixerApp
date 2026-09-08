import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { LucideAngularModule, Download, Share, X } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { InstallPromptService } from '../../services/install-prompt.service';

@Component({
  selector: 'app-install-prompt-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  template: `
    <div class="alert alert-info shadow-raised mb-4 relative pr-10" role="alert">
      @if (installPrompt.isIos) {
        <lucide-icon [img]="Share" [size]="20" class="shrink-0 self-start mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="font-medium">Instal·la l'app</p>
          <p class="text-sm">
            Toca <strong>Compartir</strong> i després
            <strong>"Afegeix a l'inici"</strong> per tenir Muixer com una app.
          </p>
        </div>
      } @else {
        <lucide-icon [img]="Download" [size]="20" class="shrink-0 self-start mt-0.5" />
        <div class="flex-1 min-w-0">
          <p class="font-medium">Instal·la l'app</p>
          <p class="text-sm">Afegeix Muixer a la pantalla d'inici del mòbil.</p>
        </div>
        <span class="shrink-0">
          <lib-button size="sm" (clicked)="installPrompt.promptInstall()">Instal·la</lib-button>
        </span>
      }
      <span class="absolute top-2 right-2">
        <lib-button
          variant="ghost"
          size="xs"
          shape="square"
          ariaLabel="Tanca"
          (clicked)="installPrompt.dismiss()"
        >
          <lucide-icon [img]="X" [size]="14" />
        </lib-button>
      </span>
    </div>
  `,
})
export class InstallPromptBannerComponent {
  protected readonly installPrompt = inject(InstallPromptService);
  protected readonly Download = Download;
  protected readonly Share = Share;
  protected readonly X = X;
}
