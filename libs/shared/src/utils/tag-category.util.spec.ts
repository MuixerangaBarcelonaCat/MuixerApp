import { TagCategory } from '../enums/tag-category.enum';
import { inferTagCategory } from './tag-category.util';

describe('inferTagCategory', () => {
  it('returns ALTRES for an empty list', () => {
    expect(inferTagCategory([])).toBe(TagCategory.ALTRES);
  });

  it('returns PINYA for only PINYA_POSITION_TYPES', () => {
    expect(inferTagCategory(['vents', 'mans'])).toBe(TagCategory.PINYA);
  });

  it('returns TRONC for only tronc/direction/base positionTypes', () => {
    expect(inferTagCategory(['segona', 'direccio-figura', 'base'])).toBe(TagCategory.TRONC);
  });

  it('returns ALTRES for a mix of tronc and pinya', () => {
    expect(inferTagCategory(['segona', 'vents'])).toBe(TagCategory.ALTRES);
  });

  it('returns ALTRES for an unknown positionType', () => {
    expect(inferTagCategory(['unknown-thing'])).toBe(TagCategory.ALTRES);
  });
});
