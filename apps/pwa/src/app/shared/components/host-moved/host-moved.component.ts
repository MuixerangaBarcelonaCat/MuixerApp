import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { ExternalLink, LucideAngularModule } from 'lucide-angular';
import { ButtonComponent, CardComponent } from '@muixer/ui';

// An installed PWA is bound to its origin, so when the PWA changes host, members still on the
// old one get a blocking screen pointing at the new address. The public URL comes from Caddy
// (`/app-host.txt`, env `PWA_PUBLIC_URL`) — see docs/DEPLOY_PRE.md «Canvi de host de la PWA».
// Anything but a valid https URL on another host (unset var, dev server's HTML fallback, offline)
// is ignored. `host` includes the port, so the same hostname on another port counts as moved.
export function movedHostUrl(publicUrl: unknown, host: string): string | null {
  if (typeof publicUrl !== 'string') return null;
  try {
    const url = new URL(publicUrl.trim());
    return url.protocol === 'https:' && url.host !== host ? url.href : null;
  } catch {
    return null;
  }
}

@Component({
  selector: 'app-host-moved',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, CardComponent, LucideAngularModule],
  template: `
    <div class="fixed inset-0 z-system overflow-y-auto bg-base-200 px-safe pt-safe-top pb-safe-bottom">
      <div class="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 p-4">
        <img src="images/logoMuixe.png" alt="MuixerApp" class="mx-auto h-20 w-20 rounded-2xl" />
        <lib-card title="L'app ha canviat d'adreça">
          <p>Esta adreça ja no s'actualitzarà. Per a continuar, instal·leu l'app des de la nova adreça:</p>
          <ol class="list-decimal space-y-1 pl-5">
            <li>Obriu la nova adreça amb el botó de baix.</li>
            <li>Inicieu la sessió amb el vostre correu i contrasenya.</li>
            <li>Instal·leu l'app: a Android, amb l'avís «Instal·la»; a iPhone, amb «Compartir» i després «Afegeix a l'inici».</li>
            <li>Esborreu esta app antiga de la pantalla d'inici.</li>
          </ol>
          <p class="break-all text-sm text-base-content/70">{{ url() }}</p>
          <lib-button [href]="url()" fullWidth>
            <lucide-icon [img]="ExternalLink" class="h-4 w-4" aria-hidden="true" />
            Obre la nova app
          </lib-button>
        </lib-card>
      </div>
    </div>
  `,
  styles: `
    .pt-safe-top {
      padding-top: env(safe-area-inset-top, 0px);
    }
    .pb-safe-bottom {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
  `,
})
export class HostMovedComponent {
  url = input.required<string>();
  protected readonly ExternalLink = ExternalLink;
}
