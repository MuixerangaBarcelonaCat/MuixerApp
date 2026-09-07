import { formatDirectionNames } from './direction-summary.util';

describe('formatDirectionNames', () => {
  it('orders names tronc → xicalla → pinya regardless of input order', () => {
    const names = formatDirectionNames([
      { positionType: 'direccio-pinya', personAlias: 'Pep' },
      { positionType: 'direccio-tronc', personAlias: 'Quim' },
      { positionType: 'direccio-xicalla', personAlias: 'Aina' },
    ]);

    expect(names).toEqual(['Quim', 'Aina (X)', 'Pep (P)']);
  });

  it('leaves the tronc flavour unmarked and marks xicalla / pinya', () => {
    const names = formatDirectionNames([
      { positionType: 'direccio-tronc', personAlias: 'Quim' },
      { positionType: 'direccio-xicalla', personAlias: 'Aina' },
      { positionType: 'direccio-pinya', personAlias: 'Pep' },
    ]);

    expect(names).toEqual(['Quim', 'Aina (X)', 'Pep (P)']);
  });

  it('suppresses markers when markers:false', () => {
    const names = formatDirectionNames(
      [{ positionType: 'direccio-pinya', personAlias: 'Pep' }],
      { markers: false },
    );

    expect(names).toEqual(['Pep']);
  });

  it('restricts to the given positionTypes', () => {
    const names = formatDirectionNames(
      [
        { positionType: 'direccio-tronc', personAlias: 'Quim' },
        { positionType: 'direccio-pinya', personAlias: 'Pep' },
      ],
      { positionTypes: ['direccio-pinya'], markers: false },
    );

    expect(names).toEqual(['Pep']);
  });

  it('keeps every name within a flavour, in input order', () => {
    const names = formatDirectionNames([
      { positionType: 'direccio-pinya', personAlias: 'Pep' },
      { positionType: 'direccio-pinya', personAlias: 'Laia' },
    ]);

    expect(names).toEqual(['Pep (P)', 'Laia (P)']);
  });

  it('returns an empty array for no directions', () => {
    expect(formatDirectionNames([])).toEqual([]);
  });
});
