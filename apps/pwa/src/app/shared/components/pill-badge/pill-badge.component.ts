import { Component, ChangeDetectionStrategy, input, output } from '@angular/core';
import { LucideAngularModule, ChevronRight, type LucideIconData } from 'lucide-angular';

@Component({
  selector: 'app-pill-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule],
  templateUrl: './pill-badge.component.html',
  styleUrls: ['./pill-badge.component.scss'],
})
export class PillBadgeComponent {
  label = input.required<string>();
  icon = input<LucideIconData>();

  clicked = output<void>();

  protected readonly ChevronRight = ChevronRight;
}
