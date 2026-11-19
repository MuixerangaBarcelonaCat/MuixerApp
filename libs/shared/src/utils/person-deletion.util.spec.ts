import { personDeletionBlockerReasons } from './person-deletion.util';

const none = { assignments: 0, attendances: 0, hasUser: false, menteeCount: 0 };

describe('personDeletionBlockerReasons', () => {
  it('returns no reasons when nothing references the person', () => {
    expect(personDeletionBlockerReasons(none)).toEqual([]);
  });

  it('lists every blocker, singular and plural', () => {
    expect(
      personDeletionBlockerReasons({ assignments: 1, attendances: 3, hasUser: true, menteeCount: 1 }),
    ).toEqual([
      "Té 3 registres d'assistència.",
      'Té 1 assignació a figures.',
      "Té un compte d'usuari vinculat.",
      "És mentora d'una persona.",
    ]);
    expect(personDeletionBlockerReasons({ ...none, attendances: 1, assignments: 2, menteeCount: 2 })).toEqual([
      "Té 1 registre d'assistència.",
      'Té 2 assignacions a figures.',
      'És mentora de 2 persones.',
    ]);
  });
});
