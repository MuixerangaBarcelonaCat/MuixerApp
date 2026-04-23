import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-global-sync',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule],
  template: `
    <div class="space-y-4 max-w-2xl mx-auto">

      <!-- Capçalera -->
      <div class="flex items-center gap-3">
        <a routerLink="/home" class="btn btn-ghost btn-sm btn-circle" aria-label="Tornar a inici">
          <lucide-icon name="ArrowLeft" [size]="18" />
        </a>
        <div>
          <h1 class="text-xl font-bold text-base-content">Sincronització global</h1>
          <p class="text-xs text-base-content/50 mt-0.5">Importa totes les dades des de l'aplicació legacy</p>
        </div>
      </div>

      <!-- Avís -->
      <div class="alert alert-warning shadow-sm">
        <lucide-icon name="AlertTriangle" [size]="18" />
        <div>
          <p class="font-semibold text-sm">Funcionalitat temporal</p>
          <p class="text-xs opacity-80">Aquesta funcionalitat desapareixerà quan MuixerApp sigui l'aplicació principal. Sincronitza primer les persones, després els events.</p>
        </div>
      </div>

      <!-- Cards de sincronització -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">

        <div class="card bg-base-100 shadow-sm border-l-4 border-primary">
          <div class="card-body p-4">
            <div class="flex items-center gap-2 mb-2">
              <lucide-icon name="Users" [size]="20" class="text-primary" />
              <h2 class="font-semibold">Persones</h2>
            </div>
            <p class="text-xs text-base-content/60 mb-3">Importa totes les persones i membres del cens legacy.</p>
            <a routerLink="/persons/sync" class="btn btn-primary btn-sm gap-1.5 w-full">
              <lucide-icon name="RefreshCw" [size]="14" />
              Sincronitzar persones
            </a>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border-l-4 border-info">
          <div class="card-body p-4">
            <div class="flex items-center gap-2 mb-2">
              <lucide-icon name="Calendar" [size]="20" class="text-info" />
              <h2 class="font-semibold">Assajos</h2>
            </div>
            <p class="text-xs text-base-content/60 mb-3">Importa tots els assajos i l'historial d'assistència.</p>
            <a routerLink="/rehearsals/sync" class="btn btn-info btn-sm gap-1.5 w-full">
              <lucide-icon name="RefreshCw" [size]="14" />
              Sincronitzar assajos
            </a>
          </div>
        </div>

        <div class="card bg-base-100 shadow-sm border-l-4 border-success">
          <div class="card-body p-4">
            <div class="flex items-center gap-2 mb-2">
              <lucide-icon name="Star" [size]="20" class="text-success" />
              <h2 class="font-semibold">Actuacions</h2>
            </div>
            <p class="text-xs text-base-content/60 mb-3">Importa totes les actuacions i l'historial d'assistència.</p>
            <a routerLink="/performances/sync" class="btn btn-success btn-sm gap-1.5 w-full">
              <lucide-icon name="RefreshCw" [size]="14" />
              Sincronitzar actuacions
            </a>
          </div>
        </div>

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
export class GlobalSyncComponent {}
