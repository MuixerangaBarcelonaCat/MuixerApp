import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterModule } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-config',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterModule, LucideAngularModule],
  template: `
    <div class="space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 class="text-xl font-bold text-base-content">Configuració</h1>
        <p class="text-xs text-base-content/50 mt-0.5">Gestió de la configuració de l'aplicació</p>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

        <a routerLink="users" class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-primary">
          <div class="card-body p-4">
            <lucide-icon name="UserCog" [size]="24" class="text-primary mb-1" />
            <h3 class="font-semibold">Usuaris</h3>
            <p class="text-xs text-base-content/50">Gestió d'accés i rols</p>
          </div>
        </a>

        <a routerLink="tags" class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-secondary">
          <div class="card-body p-4">
            <lucide-icon name="Tag" [size]="24" class="text-secondary mb-1" />
            <h3 class="font-semibold">Etiquetes</h3>
            <p class="text-xs text-base-content/50">Categories i etiquetes</p>
          </div>
        </a>

        <a routerLink="seasons" class="card bg-base-100 shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-4 border-info">
          <div class="card-body p-4">
            <lucide-icon name="CalendarRange" [size]="24" class="text-info mb-1" />
            <h3 class="font-semibold">Temporades</h3>
            <p class="text-xs text-base-content/50">Gestió de temporades</p>
          </div>
        </a>

      </div>
    </div>
  `,
})
export class ConfigComponent {}
