import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { BadgeComponent, ButtonComponent } from '@muixer/ui';
import { Info, LucideAngularModule, Users } from 'lucide-angular';

/**
 * «Pere està editant este segment»: other technicians who changed this segment in the last
 * `PRESENCE_EDITING_WINDOW_MS`. Warning-coloured pill, sized to its text, placed by the host in
 * the floating toolbar of the Pinyes and Troncs tabs so it never covers the work area.
 */
@Component({
  selector: 'app-editing-notice',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BadgeComponent, ButtonComponent, LucideAngularModule],
  template: `
    @if (aliases().length > 0) {
      <div class="flex items-center gap-1 whitespace-nowrap" role="status" data-testid="editing-badge">
        <lib-badge variant="warning" class="shadow-raised">
          <lucide-icon class="mr-1" [img]="Users" [size]="14" aria-hidden="true" />
          {{ text() }}
        </lib-badge>
        <div class="tooltip tooltip-bottom" data-testid="editing-info" [attr.data-tip]="help">
          <lib-button variant="ghost" shape="circle" size="xs" [ariaLabel]="help">
            <lucide-icon [img]="Info" [size]="14" aria-hidden="true" />
          </lib-button>
        </div>
      </div>
    }
  `,
})
export class EditingNoticeComponent {
  readonly aliases = input.required<string[]>();

  readonly Users = Users;
  readonly Info = Info;
  readonly help =
    "Podeu editar el segment alhora sense problemes. Si canvieu les mateixes posicions, els canvis d'un poden desfer els de l'altre.";

  /** «Pere està…» / «Pere i Anna estan…» / «Pere, Anna i Joan estan…» */
  readonly text = computed(() => {
    const aliases = this.aliases();
    const verb = aliases.length === 1 ? 'està' : 'estan';
    return `${new Intl.ListFormat('ca', { type: 'conjunction' }).format(aliases)} ${verb} editant este segment`;
  });
}
