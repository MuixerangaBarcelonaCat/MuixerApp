import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-pinyes-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center">
      <lucide-icon name="Layers" [size]="64" class="text-base-content/20" />
      <div>
        <h1 class="text-2xl font-bold text-base-content">Mòdul de Pinyes</h1>
        <p class="text-base-content/50 text-sm mt-2 max-w-sm">
          Aquest mòdul és en construcció. Permetrà gestionar les figures i posicions dels castellers amb un canvas interactiu.
        </p>
      </div>
      <div class="badge badge-warning gap-2">
        <lucide-icon name="Construction" [size]="14" />
        En desenvolupament
      </div>
    </div>
  `,
})
export class PinyesPlaceholderComponent {}
