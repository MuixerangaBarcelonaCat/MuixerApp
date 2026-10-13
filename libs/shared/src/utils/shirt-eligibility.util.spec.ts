import { SHIRT_REQUIREMENTS } from '../constants/person.constants';
import { compareShirtCandidates, shirtProgress } from './shirt-eligibility.util';

describe('SHIRT_REQUIREMENTS', () => {
  it('demana 2 actuacions i 6 assajos', () => {
    expect(SHIRT_REQUIREMENTS).toEqual({ performances: 2, rehearsals: 6 });
  });
});

describe('shirtProgress', () => {
  it('sense cap assistència li falten totes', () => {
    expect(shirtProgress({ performancesAttended: 0, rehearsalsAttended: 0 })).toEqual({
      missingPerformances: 2,
      missingRehearsals: 6,
      missingTotal: 8,
      isEligible: false,
    });
  });

  it('amb exactament 2 actuacions i 6 assajos té dret a camisa', () => {
    expect(shirtProgress({ performancesAttended: 2, rehearsalsAttended: 6 })).toEqual({
      missingPerformances: 0,
      missingRehearsals: 0,
      missingTotal: 0,
      isEligible: true,
    });
  });

  // Els assajos de més no compensen les actuacions que falten.
  it('els excedents no compensen l\'altre tipus', () => {
    expect(shirtProgress({ performancesAttended: 1, rehearsalsAttended: 20 })).toEqual({
      missingPerformances: 1,
      missingRehearsals: 0,
      missingTotal: 1,
      isEligible: false,
    });
  });
});

describe('compareShirtCandidates', () => {
  const candidate = (
    alias: string,
    performancesAttended: number,
    rehearsalsAttended: number,
    lastAttendedDate: string | null = null,
  ) => ({
    alias,
    performancesAttended,
    rehearsalsAttended,
    lastAttendedDate,
  });

  const sortAliases = (list: ReturnType<typeof candidate>[]) =>
    [...list].sort(compareShirtCandidates).map((c) => c.alias);

  it('posa primer qui té dret a camisa, per àlies', () => {
    expect(
      sortAliases([candidate('Zeta', 1, 6), candidate('Beta', 5, 30), candidate('Alfa', 2, 6)]),
    ).toEqual(['Alfa', 'Beta', 'Zeta']);
  });

  it('ordena la resta de més a menys a prop', () => {
    expect(
      sortAliases([candidate('Lluny', 0, 1), candidate('Prop', 1, 5), candidate('Mig', 0, 4)]),
    ).toEqual(['Prop', 'Mig', 'Lluny']);
  });

  it('a igualtat de faltes, primer qui ha vingut a més esdeveniments', () => {
    // Totes dues: li falten 2. Una ha vingut a 10 assajos, l'altra a 6.
    expect(sortAliases([candidate('Sis', 0, 6), candidate('Deu', 0, 10)])).toEqual([
      'Deu',
      'Sis',
    ]);
  });

  it('entre qui té dret, primer qui ha vingut més recentment', () => {
    expect(
      sortAliases([
        candidate('Alfa', 2, 6, '2026-03-01'),
        candidate('Beta', 2, 6, '2026-10-10'),
        candidate('Gamma', 3, 9, '2026-06-15'),
      ]),
    ).toEqual(['Beta', 'Gamma', 'Alfa']);
  });

  it('a igualtat de faltes i d\'esdeveniments, primer qui ha vingut més recentment', () => {
    expect(
      sortAliases([candidate('Abans', 1, 3, '2026-01-20'), candidate('Ara', 1, 3, '2026-10-01')]),
    ).toEqual(['Ara', 'Abans']);
  });

  it('qui no ha vingut mai va darrere de qui sí, a igualtat de la resta', () => {
    expect(
      sortAliases([candidate('Mai', 0, 0, null), candidate('Zero', 0, 0, null)]),
    ).toEqual(['Mai', 'Zero']);
    expect(
      sortAliases([candidate('Alfa', 2, 6, null), candidate('Zeta', 2, 6, '2025-01-01')]),
    ).toEqual(['Zeta', 'Alfa']);
  });

  it('a igualtat completa, per àlies', () => {
    expect(sortAliases([candidate('Pere', 1, 3), candidate('Àngela', 1, 3)])).toEqual([
      'Àngela',
      'Pere',
    ]);
  });
});
