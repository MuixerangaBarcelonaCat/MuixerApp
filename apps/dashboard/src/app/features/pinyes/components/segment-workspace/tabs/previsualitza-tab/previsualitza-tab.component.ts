import { ChangeDetectionStrategy, Component } from '@angular/core';
import { ProjectionViewComponent } from '../../../projection-view/projection-view.component';

/**
 * Previsualitza tab of the segment workspace: embeds the same
 * ProjectionViewComponent used by the segment list's "Projecta" button, so
 * any change to the projection view applies here too.
 */
@Component({
  selector: 'app-previsualitza-tab',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ProjectionViewComponent],
  templateUrl: './previsualitza-tab.component.html',
})
export class PrevisualitzaTabComponent {}
