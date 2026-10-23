import { ArrowRightToLine, Shirt, SlidersHorizontal } from 'lucide-angular';
import { DOMAIN_ICONS } from './domain-icons';

describe('DOMAIN_ICONS', () => {
  // The cordó obert is the last person of the rengla, holding the whole row tight against the
  // figure: an arrow pushing into a bar. Shared by the segment list toggle and the checkbox label.
  it('uses ArrowRightToLine for cordons oberts', () => {
    expect(DOMAIN_ICONS.CORDONS_OBERTS).toBe(ArrowRightToLine);
  });

  it('uses Shirt for the camisa', () => {
    expect(DOMAIN_ICONS.CAMISA).toBe(Shirt);
  });

  it('uses SlidersHorizontal for the colla settings', () => {
    expect(DOMAIN_ICONS.COLLA_SETTINGS).toBe(SlidersHorizontal);
  });
});
