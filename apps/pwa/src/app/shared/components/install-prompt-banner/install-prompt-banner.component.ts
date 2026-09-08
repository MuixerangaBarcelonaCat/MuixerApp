import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { Download, Share } from 'lucide-angular';
import { AlertComponent, ButtonComponent } from '@muixer/ui';
import { InstallPromptService } from '../../services/install-prompt.service';

@Component({
  selector: 'app-install-prompt-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AlertComponent, ButtonComponent],
  template: `
    <div class="mb-4">
      <lib-alert
        variant="info"
        title="Instal·la l'app"
        [icon]="installPrompt.isIos ? Share : Download"
        dismissible
        (dismissed)="installPrompt.dismiss()"
      >
        @if (installPrompt.isIos) {
          <p class="text-sm">
            Toca <strong>Compartir</strong> i després
            <strong>"Afegeix a l'inici"</strong> per tenir Muixer com una app.
          </p>
        } @else {
          <p class="text-sm">Afegeix Muixer a la pantalla d'inici del mòbil.</p>
          <span actions class="shrink-0 self-center">
            <lib-button size="sm" (clicked)="installPrompt.promptInstall()">Instal·la</lib-button>
          </span>
        }
      </lib-alert>
    </div>
  `,
})
export class InstallPromptBannerComponent {
  protected readonly installPrompt = inject(InstallPromptService);
  protected readonly Download = Download;
  protected readonly Share = Share;
}
