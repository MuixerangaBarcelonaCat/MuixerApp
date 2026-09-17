import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LucideAngularModule, RefreshCw } from 'lucide-angular';
import { ButtonComponent } from '@muixer/ui';
import { SegmentWorkspaceStateService } from '../../services/segment-workspace-state.service';

/**
 * Persistent (not auto-dismissing) banner shown when a live-push change arrived while the
 * user was mid-drag or had a mutation in flight — refetching immediately would have risked
 * clobbering that. Mounted once at the workspace level (visible on every tab), same as
 * `SegmentConflictPanelComponent`. Most of the time this never appears: an unrelated remote
 * change refreshes silently, and the auto-apply in `SegmentWorkspaceStateService` clears a
 * pending one shortly after the user stops interacting, without needing a click.
 */
@Component({
  selector: 'app-live-update-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './live-update-banner.component.html',
})
export class LiveUpdateBannerComponent {
  readonly ws = inject(SegmentWorkspaceStateService);
  protected readonly RefreshCw = RefreshCw;

  apply(): void {
    this.ws.applyPendingRemoteChange();
  }
}
