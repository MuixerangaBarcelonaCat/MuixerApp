import { Component, ChangeDetectionStrategy } from '@angular/core';
import { LucideAngularModule, AlertTriangle } from 'lucide-angular';

@Component({
  selector: 'app-no-person-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <div class="alert alert-warning shadow-sm mb-4" role="alert">
      <lucide-icon [img]="AlertTriangle" [size]="20" />
      <div>
        <p class="font-medium">Compte no vinculat</p>
        <p class="text-sm">
          El compte no està vinculat a cap membre. Contacteu amb l'equip
          tècnic.
        </p>
      </div>
    </div>
  `,
})
export class NoPersonBannerComponent {
  protected readonly AlertTriangle = AlertTriangle;
}
