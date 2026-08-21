import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent, CardComponent } from '@muixer/ui';
import { DOMAIN_ICONS } from '../../shared/constants/domain-icons';

@Component({
  selector: 'app-global-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule, ButtonComponent, CardComponent],
  template: `
    <div class="space-y-4 max-w-2xl mx-auto">

      <!-- Capçalera -->
      <div class="flex items-center gap-3">
        <lib-button variant="ghost" shape="circle" size="sm" ariaLabel="Tornar a inici" routerLink="/home">
          <lucide-icon name="ArrowLeft" [size]="18" />
        </lib-button>
        <div>
          <h1 class="text-xl font-bold font-serif text-base-content">Sincronització global</h1>
          <p class="text-xs text-base-content/50 mt-0.5">Importa totes les dades des de l'aplicació legacy</p>
        </div>
      </div>

      <!-- Avís -->
      <div class="alert alert-warning shadow-raised">
        <lucide-icon name="AlertTriangle" [size]="18" />
        <div>
          <p class="font-semibold text-sm">Funcionalitat temporal</p>
          <p class="text-xs opacity-80">Aquesta funcionalitat desapareixerà quan MuixerApp sigui l'aplicació principal. Sincronitza primer les persones, després els events.</p>
        </div>
      </div>

      <!-- Cards de sincronització -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <lib-card sash="title" title="Sincronitza persones" [icon]="ICON_PERSONA" routerLink="/persons/sync-start">
          <p class="text-sm text-base-content/60">Importa totes les persones i membres del cens legacy.</p>
        </lib-card>

        <lib-card sash="title" title="Sincronitza assajos" [icon]="ICON_ASSAIG" routerLink="/rehearsals/sync">
          <p class="text-sm text-base-content/60">Importa tots els assajos i l'historial d'assistència.</p>
        </lib-card>

        <lib-card sash="title" title="Sincronitza actuacions" [icon]="ICON_ACTUACIO" routerLink="/performances/sync">
          <p class="text-sm text-base-content/60">Importa totes les actuacions i l'historial d'assistència.</p>
        </lib-card>

        <div class="card bg-base-200 shadow-none border border-base-300">
          <div class="card-body p-4 items-center justify-center text-center">
            <lucide-icon name="Info" [size]="24" class="text-base-content/30 mb-2" />
            <p class="text-xs text-base-content/50">Recorda sincronitzar primer les <strong>persones</strong> per garantir que les assistències s'assignen correctament.</p>
          </div>
        </div>

      </div>
    </div>
  `,
})
export class GlobalSyncComponent {
  readonly ICON_PERSONA = DOMAIN_ICONS.PERSONA;
  readonly ICON_ASSAIG = DOMAIN_ICONS.ASSAIG;
  readonly ICON_ACTUACIO = DOMAIN_ICONS.ACTUACIO;
}
