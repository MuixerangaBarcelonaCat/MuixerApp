import { Component, ChangeDetectionStrategy, input } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-config-placeholder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="flex flex-col items-center justify-center min-h-[40vh] gap-4 text-center">
      <lucide-icon name="Settings" [size]="48" class="text-base-content/20" />
      <div>
        <h2 class="text-lg font-bold text-base-content">{{ title() }}</h2>
        <p class="text-base-content/50 text-sm mt-1">Secció pendent de desenvolupament</p>
      </div>
      <div class="badge badge-warning gap-2">
        <lucide-icon name="Construction" [size]="14" />
        En desenvolupament
      </div>
    </div>
  `,
})
export class ConfigPlaceholderComponent {
  title = input('Configuració');
}
