import { Component, ChangeDetectionStrategy, inject, input, signal } from '@angular/core';
import { Check, Copy, ExternalLink, LucideAngularModule } from 'lucide-angular';
import { ButtonComponent, CardComponent } from '@muixer/ui';
import { InstallPromptService } from '../../services/install-prompt.service';
import { PUSH_OPTED_OUT_KEY } from '../../../core/services/push-subscription.service';

// An installed PWA is bound to its origin, so when the PWA changes host, members still on the
// old one get a blocking screen pointing at the new address. The public URL comes from Caddy
// (`/app-host.txt`, env `PWA_PUBLIC_URL`) — see docs/DEPLOY_PRE.md «Canvi de host de la PWA».
// Anything but a valid https URL on another host (unset var, dev server's HTML fallback, offline)
// is ignored. `host` includes the port, so the same hostname on another port counts as moved.
// Path and query are kept so an old invite link (`/activate?token=…`) still works on the new host.
export function movedHostUrl(
  publicUrl: unknown,
  here: Pick<Location, 'host' | 'pathname' | 'search'>,
): string | null {
  if (typeof publicUrl !== 'string') return null;
  try {
    const url = new URL(publicUrl.trim());
    if (url.protocol !== 'https:' || url.host === here.host) return null;
    // Concatenate, never resolve: a `//evil.com` path would resolve to another origin.
    return url.origin + here.pathname + here.search;
  } catch {
    return null;
  }
}

// The old origin's push subscription outlives the move: without this, a member who keeps the old
// app installed gets every notification twice. Browser-side only — no session here for the
// authenticated DELETE; the API deactivates the endpoint on the next send (410, web-push.provider).
export async function dropPushSubscription(): Promise<void> {
  try {
    // Origin-scoped opt-out: stops PushSubscriptionService.syncOnStartup from subscribing again.
    localStorage.setItem(PUSH_OPTED_OUT_KEY, 'true');
    const registration = await navigator.serviceWorker?.ready;
    const subscription = await registration?.pushManager.getSubscription();
    await subscription?.unsubscribe();
  } catch {
    // Push unsupported or already gone: nothing to drop.
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
            @if (standalone) {
              <li>
                Si s'obri dins d'esta app, passeu al navegador:
                {{ isIos ? 'toqueu la icona de Safari o «Obre a Safari»' : 'toqueu ⋮ i després «Obre a Chrome»' }}.
                També podeu copiar l'adreça i apegar-la al navegador.
              </li>
            }
            <li>
              Inicieu la sessió amb el vostre correu i contrasenya. Si veníeu d'un enllaç d'invitació, acabeu
              d'activar el compte.
            </li>
            <li>
              Instal·leu l'app: a Android, amb l'avís «Instal·la»; a iPhone, amb «Compartir» i després «Afegeix a
              l'inici». A iPhone, cal tornar a iniciar la sessió dins de l'app nova.
            </li>
            <li>Activeu les notificacions a l'app nova.</li>
            <li>Esborreu esta app antiga de la pantalla d'inici.</li>
          </ol>
          <p class="break-all text-sm text-base-content/70">{{ url() }}</p>
          <lib-button [href]="url()" fullWidth>
            <lucide-icon [img]="ExternalLink" class="h-4 w-4" aria-hidden="true" />
            Obre la nova app
          </lib-button>
          <lib-button variant="neutral" outline fullWidth (clicked)="copy()">
            <lucide-icon [img]="copied() ? Check : Copy" class="h-4 w-4" aria-hidden="true" />
            {{ copied() ? "S'ha copiat l'adreça" : "Copia l'adreça" }}
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
  protected readonly Copy = Copy;
  protected readonly Check = Check;

  private readonly installPrompt = inject(InstallPromptService);
  // Opened from the installed app, the button lands in an in-app browser that cannot install the PWA.
  protected readonly standalone = this.installPrompt.isStandalone();
  protected readonly isIos = this.installPrompt.isIos;
  protected readonly copied = signal(false);

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.url());
      this.copied.set(true);
    } catch {
      // No clipboard (old iOS, insecure context): the address stays visible above.
    }
  }
}
