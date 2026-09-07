import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import {
  formatOwnPosition,
  ownPositionMultiplePlacements,
  ownPositionNoPlacement,
  OwnPositionSegment,
  OwnPositionSubject,
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
    class: 'block rounded-2xl bg-black/60 backdrop-blur-sm shadow-lg px-4 py-2.5 text-sm text-white',
    '[class.text-error]': "state().kind === 'MULTIPLE'",
    'aria-live': 'polite',
  },
  templateUrl: './own-position-banner.component.html',
})
export class OwnPositionBannerComponent {
  readonly state = input.required<OwnPositionBannerState>();

  /** Who the banner is about — the caller by default, or someone they looked up via the PWA's
   *  person search. Swaps «Sou…» for «{alias} és…» and the action button's label. */
  readonly subject = input<OwnPositionSubject>({ kind: 'self' });

  /** Emitted by the Troba'm/On està button. Absent for the MULTIPLE and NONE states — see the plan. */
  readonly troba = output<void>();

  /** Emitted by the back-to-me button, shown only while `subject` is 'other'. */
  readonly back = output<void>();

  protected readonly isOther = computed(() => this.subject().kind === 'other');
  protected readonly actionLabel = computed(() => (this.subject().kind === 'self' ? "Troba'm" : 'On està'));
  protected readonly noPlacementText = computed(() => ownPositionNoPlacement(this.subject()));
  protected readonly multiplePlacementsText = computed(() => ownPositionMultiplePlacements(this.subject()));

  protected readonly segments = computed((): OwnPositionSegment[] => {
    const s = this.state();
    const subject = this.subject();
    if (s.kind === 'PINYA') {
      return formatOwnPosition(
        { nodeLabel: s.nodeLabel, cordon: s.cordon, figureName: s.figureName, behind: s.behind },
        subject,
      );
    }
    if (s.kind === 'TRONC') {
      return formatOwnPosition(
        { nodeLabel: s.nodeLabel, cordon: null, figureName: s.figureName, below: s.below, above: s.above },
        subject,
      );
    }
    return [];
  });

  /** The figure's palette colour — matches its canvas silhouette and tronc panel border. */
  protected readonly figureColor = computed(() => {
    const s = this.state();
    return s.kind === 'PINYA' || s.kind === 'TRONC' ? getFigureColor(s.instanceIndex) : null;
  });
}
