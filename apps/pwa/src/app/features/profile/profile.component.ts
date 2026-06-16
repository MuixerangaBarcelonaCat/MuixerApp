import { Component, ChangeDetectionStrategy } from '@angular/core';
import { MobileHeaderComponent } from '../../shared/components/mobile-header/mobile-header.component';

@Component({
  selector: 'app-profile',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MobileHeaderComponent],
  template: `
    <app-mobile-header title="Perfil" />
    <section class="py-4">
      <div class="card bg-base-100 shadow-sm">
        <div class="card-body">
          <p class="text-base-content/70">Pròximament: perfil del membre</p>
        </div>
      </div>
    </section>
  `,
})
export class ProfileComponent {}
