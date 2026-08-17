import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Search, Star, Users } from 'lucide-angular';
import {
  ButtonComponent,
  BadgeComponent,
  CardComponent,
  InputComponent,
  ModalComponent,
  ToastContainerComponent,
  ToastService,
  EmptyStateComponent,
  type ButtonVariant,
  type BadgeVariant,
} from '@muixer/ui';

const VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'accent', 'neutral', 'ghost', 'info', 'success', 'warning', 'error'];
const BADGE_VARIANTS: BadgeVariant[] = ['primary', 'secondary', 'accent', 'neutral', 'ghost', 'info', 'success', 'warning', 'error'];

@Component({
  selector: 'app-components-section',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonComponent, BadgeComponent, CardComponent, InputComponent, ModalComponent, ToastContainerComponent, EmptyStateComponent],
  templateUrl: './components-section.component.html',
})
export class ComponentsSectionComponent {
  protected readonly SearchIcon = Search;
  protected readonly StarIcon = Star;
  protected readonly UsersIcon = Users;

  protected readonly variants = VARIANTS;
  protected readonly badgeVariants = BADGE_VARIANTS;

  protected readonly dismissibleModalOpen = signal(false);
  protected readonly nonDismissibleModalOpen = signal(false);

  private readonly toast = inject(ToastService);

  protected fireToast(type: 'success' | 'error' | 'warning' | 'info'): void {
    this.toast[type](`Exemple de missatge ${type}.`);
  }
}
