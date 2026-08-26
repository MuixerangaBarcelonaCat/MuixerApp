import { TagCategory } from '../enums/tag-category.enum';
import { evaluateTagCompliance } from './tag-compliance.util';

describe('evaluateTagCompliance', () => {
  it('compleix amb només una etiqueta de xicalla', () => {
    expect(evaluateTagCompliance([TagCategory.XICALLA])).toEqual({ ok: true, missing: [] });
  });

  it('compleix amb només una etiqueta d\'altres', () => {
    expect(evaluateTagCompliance([TagCategory.ALTRES])).toEqual({ ok: true, missing: [] });
  });

  it('compleix amb pinya i tronc alhora', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA, TagCategory.TRONC])).toEqual({
      ok: true,
      missing: [],
    });
  });

  // Aquest cas fixa la decisió de disseny: satisfer més d'una condició NO és un avís.
  it('compleix amb xicalla, pinya i tronc alhora', () => {
    expect(
      evaluateTagCompliance([TagCategory.XICALLA, TagCategory.PINYA, TagCategory.TRONC]),
    ).toEqual({ ok: true, missing: [] });
  });

  it('no compleix sense cap etiqueta i demana pinya i tronc', () => {
    expect(evaluateTagCompliance([])).toEqual({
      ok: false,
      missing: [TagCategory.PINYA, TagCategory.TRONC],
    });
  });

  it('no compleix amb només pinya i demana tronc', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA])).toEqual({
      ok: false,
      missing: [TagCategory.TRONC],
    });
  });

  it('no compleix amb només tronc i demana pinya', () => {
    expect(evaluateTagCompliance([TagCategory.TRONC])).toEqual({
      ok: false,
      missing: [TagCategory.PINYA],
    });
  });

  it('ignora etiquetes repetides del mateix grup', () => {
    expect(evaluateTagCompliance([TagCategory.PINYA, TagCategory.PINYA])).toEqual({
      ok: false,
      missing: [TagCategory.TRONC],
    });
  });
});
