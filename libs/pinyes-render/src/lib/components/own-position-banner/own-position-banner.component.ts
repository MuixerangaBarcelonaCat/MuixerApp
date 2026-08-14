import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  formatOwnPosition,
  OWN_POSITION_MULTIPLE_PLACEMENTS,
  OWN_POSITION_NO_PLACEMENT,
  OwnPositionSegment,
} from '@muixer/shared';
import { getFigureColor } from '../../utils/figure-palette.util';
import { OwnPlacementDescription } from '../../utils/own-position.util';

/**
 * `PINYA`/`TRONC` render the phrase; `MULTIPLE` is the invariant-4 edge case (should never reach
 * the PWA); `NONE` means the caller holds no placement in this segment at all.
 */
export type OwnPositionBannerState = OwnPlacementDescription | { kind: 'MULTIPLE' } | { kind: 'NONE' };

@Component({
  selector: 'lib-own-position-banner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'block rounded-2xl bg-black/70 backdrop-blur-sm shadow-lg px-4 py-2.5 text-sm text-white',
    '[class.text-error]': "state().kind === 'MULTIPLE'",
    'aria-live': 'polite',
  },
  templateUrl: './own-position-banner.component.html',
})
export class OwnPositionBannerComponent {
  readonly state = input.required<OwnPositionBannerState>();

  /** Emitted by the Troba'm button. Absent for the MULTIPLE and NONE states — see the plan. */
  readonly troba = output<void>();

  protected readonly OWN_POSITION_MULTIPLE_PLACEMENTS = OWN_POSITION_MULTIPLE_PLACEMENTS;
  protected readonly OWN_POSITION_NO_PLACEMENT = OWN_POSITION_NO_PLACEMENT;

  protected readonly segments = computed((): OwnPositionSegment[] => {
    const s = this.state();
    if (s.kind === 'PINYA') {
      return formatOwnPosition({ nodeLabel: s.nodeLabel, cordon: s.cordon, figureName: s.figureName, behind: s.behind });
    }
    if (s.kind === 'TRONC') {
      return formatOwnPosition({
        nodeLabel: s.nodeLabel,
        cordon: null,
        figureName: s.figureName,
        below: s.below,
        above: s.above,
      });
    }
    return [];
  });

  /** The figure's palette colour — matches its canvas silhouette and tronc panel border. */
  protected readonly figureColor = computed(() => {
    const s = this.state();
    return s.kind === 'PINYA' || s.kind === 'TRONC' ? getFigureColor(s.instanceIndex) : null;
  });
}
