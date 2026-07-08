import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  template: `
    <header class="flex items-center gap-3 py-3 mb-2">
      @if (showBack()) {
        <button
          (click)="goBack()"
          class="btn btn-ghost btn-circle btn-sm"
          aria-label="Torna enrere"
        >
          <lucide-icon [img]="ArrowLeft" [size]="20" />
        </button>
      }
      <h1 class="text-lg font-semibold truncate">{{ title() }}</h1>
    </header>
  `,
})
export class MobileHeaderComponent {
  title = input.required<string>();
  showBack = input(false);
  fallbackRoute = input('/home');

  protected readonly ArrowLeft = ArrowLeft;
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  goBack(): void {
    if ((window.history?.length ?? 0) > 1) {
      this.location.back();
    } else {
      this.router.navigate([this.fallbackRoute()]);
    }
  }
}
