import {
  Component,
  ChangeDetectionStrategy,
  input,
  inject,
} from '@angular/core';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { LucideAngularModule, ArrowLeft } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';

@Component({
  selector: 'app-mobile-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './mobile-header.component.html',
})
export class MobileHeaderComponent {
  title = input.required<string>();
  showBack = input(false);
  fallbackRoute = input('/home');
  // For a screen reachable from more than one real parent (e.g. event-detail: home shortcuts,
  // the agenda list, the calendar view) — real browser history would return to whichever of
  // those the caller actually came from, but the screen has one canonical parent regardless.
  // Set this to always go there instead of trusting `location.back()`.
  alwaysFallback = input(false);

  protected readonly ArrowLeft = ArrowLeft;
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  goBack(): void {
    if (!this.alwaysFallback() && (window.history?.length ?? 0) > 1) {
      this.location.back();
    } else {
      this.router.navigate([this.fallbackRoute()]);
    }
  }
}
