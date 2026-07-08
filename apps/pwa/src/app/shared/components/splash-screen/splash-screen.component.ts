import { Component, ChangeDetectionStrategy, input } from '@angular/core';

@Component({
  selector: 'app-splash-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="fixed inset-0 flex items-center justify-center bg-base-200 z-[9999]"
      role="status"
      aria-label="Carregant aplicació"
    >
      <div class="text-center">
        <img
          [src]="logoUrl()"
          alt="MuixerApp"
          class="w-20 h-20 mx-auto mb-4 rounded-2xl"
        />
        <span class="loading loading-dots loading-md text-primary"></span>
      </div>
    </div>
  `,
})
export class SplashScreenComponent {
  logoUrl = input('images/logoMuixe.png');
}
