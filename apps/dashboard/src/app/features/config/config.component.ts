import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CardComponent } from '@muixer/ui';
import { DOMAIN_ICONS } from '../../shared/constants/domain-icons';
import { AuthService } from '../../core/auth/services/auth.service';

@Component({
  selector: 'app-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, CardComponent],
  template: `
    <div class="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 class="text-xl font-bold font-serif text-base-content">Configuració</h1>
        <p class="text-xs text-base-content/50 mt-0.5">Gestió de la configuració de l'aplicació</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">

        <lib-card sash="title" title="Usuaris" [icon]="ICON_USERS" routerLink="users">
          <p class="text-md text-base-content/60">Gestió d'accés i rols</p>
        </lib-card>

        <lib-card sash="title" title="Etiquetes" [icon]="ICON_TAG" routerLink="tags">
          <p class="text-md text-base-content/60">Categories i etiquetes</p>
        </lib-card>

        <lib-card sash="title" title="Temporades" [icon]="ICON_SEASONS" routerLink="seasons">
          <p class="text-md text-base-content/60">Gestió de temporades</p>
        </lib-card>

        @if (auth.isAdmin()) {
          <lib-card sash="title" title="Privacitat i legal" [icon]="ICON_LEGAL" routerLink="legal">
            <p class="text-md text-base-content/60">Política de privacitat i clàusules</p>
          </lib-card>
        }

        @if (auth.isAdmin()) {
          <lib-card sash="title" title="Design System" [icon]="ICON_DESIGN_SYSTEM" routerLink="/design-system">
            <p class="text-md text-base-content/60">Tokens i llibreria de components libs/ui</p>
          </lib-card>
        }

      </div>
    </div>
  `,
})
export class ConfigComponent {
  protected readonly auth = inject(AuthService);

  protected readonly ICON_USERS = DOMAIN_ICONS.USER_COG;
  protected readonly ICON_TAG = DOMAIN_ICONS.TAG;
  protected readonly ICON_SEASONS = DOMAIN_ICONS.CALENDAR_RANGE;
  protected readonly ICON_LEGAL = DOMAIN_ICONS.SHIELD_CHECK;
  protected readonly ICON_DESIGN_SYSTEM = DOMAIN_ICONS.DESIGN_SYSTEM;
}
