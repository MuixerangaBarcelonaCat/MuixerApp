import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { ICON_COMPOSITION } from '../../../../../shared/constants/domain-icons';
import { EmptyStateComponent } from '../../../../../shared/components/data/empty-state/empty-state.component';

@Component({
  selector: 'app-composition-grid-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, EmptyStateComponent],
  template: `
    <div class="mt-4">
      <app-empty-state
        [icon]="ICON_COMPOSITION"
        message="Les composicions estaran disponibles properament."
      />
    </div>
  `,
})
export class CompositionGridTabComponent {
  readonly ICON_COMPOSITION = ICON_COMPOSITION;
}
