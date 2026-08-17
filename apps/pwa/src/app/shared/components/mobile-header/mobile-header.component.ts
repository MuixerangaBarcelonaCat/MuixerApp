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
  templateUrl: './mobile-header.component.html',
  styleUrls: ['./mobile-header.component.scss'],
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
