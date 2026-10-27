import { ageOn, deriveIsXicalla } from './age.util';

describe('ageOn', () => {
  it('counts a full year on the birthday itself', () => {
    expect(ageOn('2010-05-12', '2026-05-12')).toBe(16);
  });

  it('does not count the year until the birthday arrives', () => {
    expect(ageOn('2010-05-12', '2026-05-11')).toBe(15);
  });

  it('compares the day when the month matches', () => {
    expect(ageOn('2010-05-12', '2026-05-13')).toBe(16);
  });

  it('turns a 29 February birthday on 1 March in a non-leap year', () => {
    expect(ageOn('2008-02-29', '2025-02-28')).toBe(16);
    expect(ageOn('2008-02-29', '2025-03-01')).toBe(17);
  });

  it('turns a 29 February birthday on the day itself in a leap year', () => {
    expect(ageOn('2024-02-29', '2028-02-29')).toBe(4);
  });

  it('is 0 for someone born today', () => {
    expect(ageOn('2026-10-13', '2026-10-13')).toBe(0);
  });
});

describe('deriveIsXicalla', () => {
  const today = '2026-10-13';

  it('uses the manual flag when there is no birth date', () => {
    expect(deriveIsXicalla({ birthDate: null, isXicallaManual: true }, 16, today)).toBe(true);
    expect(deriveIsXicalla({ birthDate: null, isXicallaManual: false }, 16, today)).toBe(false);
  });

  it('ignores the manual flag when there is a birth date', () => {
    expect(deriveIsXicalla({ birthDate: '2000-01-01', isXicallaManual: true }, 16, today)).toBe(false);
    expect(deriveIsXicalla({ birthDate: '2020-01-01', isXicallaManual: false }, 16, today)).toBe(true);
  });

  it('is no longer xicalla from the birthday that reaches the age of majority', () => {
    expect(deriveIsXicalla({ birthDate: '2010-10-13', isXicallaManual: false }, 16, today)).toBe(false);
    expect(deriveIsXicalla({ birthDate: '2010-10-14', isXicallaManual: false }, 16, today)).toBe(true);
  });

  it('follows the configured age of majority', () => {
    const person = { birthDate: '2009-01-01', isXicallaManual: false };
    expect(deriveIsXicalla(person, 16, today)).toBe(false);
    expect(deriveIsXicalla(person, 18, today)).toBe(true);
  });
});
