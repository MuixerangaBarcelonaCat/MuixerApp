import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { LucideIconData } from 'lucide-angular';
import { LucideAngularModule } from 'lucide-angular';
import { contrastContent, formatOklch, hexToOklch } from '../../tokens/color';
import { INK, PAPER } from '../../tokens/fixed-colors';
import { generateFringeThreads } from './sash-fringe.util';

export type CardSash = 'none' | 'thin' | 'title';

const INK_BLACK = hexToOklch(INK.black);
const PAPER_WHITE = hexToOklch(PAPER.white);

// Band heights per sash mode — 'title' is tall enough to hold icon+text comfortably (approved
// after an earlier 30px pass felt cramped), 'thin' stays close to the border-l-4 it replaces.
const BAND_HEIGHT: Record<Exclude<CardSash, 'none'>, number> = {
  thin: 16,
  title: 38,
};
const BAND_TOP = 16;
// The band is position:absolute (removed from flow, since it deliberately overhangs the card's
// own left/right edges) — .body must reserve this much top padding itself or content renders
// underneath it. Matches the approved mockups' values, not a recomputed formula, since the two
// weren't derived from one consistent gap in the first place.
const BODY_PADDING_TOP: Record<Exclude<CardSash, 'none'>, number> = {
  thin: 40,
  title: 68,
};
const FRINGE_MAX_LENGTH = 34;

@Component({
  selector: 'lib-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [LucideAngularModule, NgTemplateOutlet, RouterLink],
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.scss'],
})
export class CardComponent {
  sash = input<CardSash>('none');
  title = input<string>();
  icon = input<LucideIconData>();
  // Both default to the shared sash token (--ds-sash-fill/-content) and the CSS default icon
  // color respectively — these are overrides, not the normal path.
  sashColor = input<string>();
  iconColor = input<string>();
  // Interactive modes — at most one of these is meaningful at a time; routerLink wins over href,
  // href wins over clickable, matching the order a consumer would reach for them.
  routerLink = input<string | unknown[]>();
  href = input<string>();
  clickable = input(false, { transform: booleanAttribute });

  clicked = output<void>();

  protected readonly bandTop = BAND_TOP;

  protected readonly hasBand = computed(() => this.sash() !== 'none');
  protected readonly titleOnBand = computed(() => this.sash() === 'title');

  protected readonly bandHeight = computed(() => {
    const sash = this.sash();
    return sash === 'none' ? 0 : BAND_HEIGHT[sash];
  });

  protected readonly bodyPaddingTop = computed(() => {
    const sash = this.sash();
    return sash === 'none' ? null : BODY_PADDING_TOP[sash];
  });

  protected readonly fringeThreads = computed(() =>
    this.hasBand() ? generateFringeThreads(this.bandHeight(), FRINGE_MAX_LENGTH) : [],
  );

  protected readonly sashContentColor = computed(() => {
    const color = this.sashColor();
    if (!color) {
      return null;
    }
    return formatOklch(contrastContent(hexToOklch(color), INK_BLACK, PAPER_WHITE));
  });
}
