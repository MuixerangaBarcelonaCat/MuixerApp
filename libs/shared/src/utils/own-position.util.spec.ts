import {
  elideDe,
  formatOwnPosition,
  formatOwnPositionSummary,
  OWN_POSITION_MULTIPLE_PLACEMENTS,
  OWN_POSITION_NO_PLACEMENT,
  OwnPositionInput,
  OwnPositionSubject,
  ownPositionMultiplePlacements,
  ownPositionNoPlacement,
  ownPositionToPlainText,
} from './own-position.util';

const plain = (input: OwnPositionInput, subject?: OwnPositionSubject): string =>
  ownPositionToPlainText(formatOwnPosition(input, subject));

const base = (overrides: Partial<OwnPositionInput> = {}): OwnPositionInput => ({
  nodeLabel: 'Lateral',
  cordon: null,
  figureName: null,
  ...overrides,
});

describe('elideDe', () => {
  it('keeps the full preposition before a consonant', () => {
    expect(elideDe('Marta')).toBe('de ');
  });

  it.each(['Anna', 'Elena', 'Isabel', 'Oriol', 'Ulises'])('elides before the vowel in %s', (name) => {
    expect(elideDe(name)).toBe("d'");
  });

  it('elides before a silent h', () => {
    expect(elideDe('Hugo')).toBe("d'");
  });

  it.each(['Àngel', 'Òscar', 'Élia'])('elides before the accented vowel in %s', (name) => {
    expect(elideDe(name)).toBe("d'");
  });

  it('is case-insensitive', () => {
    expect(elideDe('anna')).toBe("d'");
    expect(elideDe('marta')).toBe('de ');
  });

  it('falls back to the full preposition for an empty name', () => {
    expect(elideDe('')).toBe('de ');
  });
});

describe('formatOwnPosition', () => {
  describe('the base clause', () => {
    it('states the node label alone when there is nothing else to add', () => {
      expect(plain(base())).toBe('Sou Lateral.');
    });

    it('adds the cordó when the node belongs to a rengla', () => {
      expect(plain(base({ cordon: 2 }))).toBe('Sou Lateral (cordó 2).');
    });

    it('adds the figure name when the segment has more than one figure', () => {
      expect(plain(base({ cordon: 2, figureName: 'Roscana' }))).toBe('Sou Lateral (cordó 2) a Roscana.');
    });

    it('omits the figure clause entirely when there is no figure name', () => {
      expect(plain(base({ figureName: null }))).not.toContain(' a ');
    });

    it('never uppercases the data — casing is the template\'s job', () => {
      expect(plain(base({ nodeLabel: 'mans', figureName: 'roscana' }))).toBe('Sou mans a roscana.');
    });
  });

  describe('the pinya clause', () => {
    it('names the person one rengla position inward', () => {
      expect(plain(base({ cordon: 2, figureName: 'Roscana', behind: 'Marta' }))).toBe(
        'Sou Lateral (cordó 2) a Roscana, darrere de Marta.',
      );
    });

    it('elides the preposition before a vowel', () => {
      expect(plain(base({ cordon: 2, behind: 'Anna' }))).toBe("Sou Lateral (cordó 2), darrere d'Anna.");
    });

    it('omits the clause when there is nobody inward', () => {
      expect(plain(base({ cordon: 1, behind: null }))).toBe('Sou Lateral (cordó 1).');
    });
  });

  describe('the tronc clauses', () => {
    const tronc = (overrides: Partial<OwnPositionInput> = {}) =>
      base({ nodeLabel: 'Segons', figureName: 'Roscana', ...overrides });

    it('names the people below with «damunt» and the people above with «davall»', () => {
      expect(plain(tronc({ below: ['Joan', 'Pere'], above: ['Marta'] }))).toBe(
        'Sou Segons a Roscana, damunt de Joan i Pere, davall de Marta.',
      );
    });

    it('omits «davall» when nobody stands above', () => {
      expect(plain(tronc({ below: ['Joan', 'Pere'], above: [] }))).toBe(
        'Sou Segons a Roscana, damunt de Joan i Pere.',
      );
    });

    it('omits «damunt» when nobody stands below', () => {
      expect(plain(tronc({ below: [], above: ['Marta'] }))).toBe('Sou Segons a Roscana, davall de Marta.');
    });

    it('states the position alone when there is no neighbour on either side', () => {
      expect(plain(tronc())).toBe('Sou Segons a Roscana.');
    });

    it('joins three or more names with commas and a final «i»', () => {
      expect(plain(tronc({ below: ['Joan', 'Pere', 'Anna'] }))).toBe(
        'Sou Segons a Roscana, damunt de Joan, Pere i Anna.',
      );
    });

    it('elides the preposition against the first name of the list', () => {
      expect(plain(tronc({ below: ['Anna', 'Pere'] }))).toBe("Sou Segons a Roscana, damunt d'Anna i Pere.");
    });
  });

  describe('the segment structure', () => {
    it('tags the node label, the figure name and every alias so the template can style them', () => {
      const segments = formatOwnPosition(
        base({ cordon: 2, figureName: 'Roscana', below: ['Joan', 'Pere'] }),
      );

      expect(segments).toEqual([
        { kind: 'text', value: 'Sou ' },
        { kind: 'label', value: 'Lateral' },
        { kind: 'text', value: ' (cordó 2) a ' },
        { kind: 'figure', value: 'Roscana' },
        { kind: 'text', value: ', damunt de ' },
        { kind: 'alias', value: 'Joan' },
        { kind: 'text', value: ' i ' },
        { kind: 'alias', value: 'Pere' },
        { kind: 'text', value: '.' },
      ]);
    });

    it('merges adjacent text so the template never renders an empty span', () => {
      const segments = formatOwnPosition(base());
      expect(segments.filter((s) => s.kind === 'text')).toEqual([
        { kind: 'text', value: 'Sou ' },
        { kind: 'text', value: '.' },
      ]);
    });
  });
});

describe('formatOwnPosition for another person', () => {
  const other: OwnPositionSubject = { kind: 'other', alias: 'Marta' };

  it('opens with the alias and «és» instead of «Sou»', () => {
    expect(plain(base(), other)).toBe('Marta és Lateral.');
  });

  it('keeps the rest of the clause identical to the self phrasing', () => {
    expect(plain(base({ cordon: 2, figureName: 'Roscana', behind: 'Anna' }), other)).toBe(
      "Marta és Lateral (cordó 2) a Roscana, darrere d'Anna.",
    );
  });

  it('tags the alias as its own segment, distinct from a neighbour alias', () => {
    const segments = formatOwnPosition(base(), other);
    expect(segments).toEqual([
      { kind: 'alias', value: 'Marta' },
      { kind: 'text', value: ' és ' },
      { kind: 'label', value: 'Lateral' },
      { kind: 'text', value: '.' },
    ]);
  });
});

describe('ownPositionNoPlacement', () => {
  it('defaults to the self phrasing', () => {
    expect(ownPositionNoPlacement()).toBe(OWN_POSITION_NO_PLACEMENT);
  });

  it('names the other person when given a third-party subject', () => {
    expect(ownPositionNoPlacement({ kind: 'other', alias: 'Marta' })).toBe('Marta no ix en este segment.');
  });
});

describe('ownPositionMultiplePlacements', () => {
  it('defaults to the self phrasing', () => {
    expect(ownPositionMultiplePlacements()).toBe(OWN_POSITION_MULTIPLE_PLACEMENTS);
  });

  it('names the other person when given a third-party subject', () => {
    expect(ownPositionMultiplePlacements({ kind: 'other', alias: 'Marta' })).toBe(
      "Marta està en més d'un lloc alhora. Parleu amb la tècnica.",
    );
  });
});

describe('formatOwnPositionSummary', () => {
  it('states the position, cordon and figure when all three are known', () => {
    expect(formatOwnPositionSummary({ nodeLabel: 'Vent', cordon: 1, figureName: 'Roscana' })).toEqual({
      nodeLabel: 'Vent',
      suffix: ' (C1) a Roscana',
    });
  });

  it('omits the cordon clause when the node has no rengla position', () => {
    expect(formatOwnPositionSummary({ nodeLabel: 'Vent', cordon: null, figureName: 'Roscana' })).toEqual({
      nodeLabel: 'Vent',
      suffix: ' a Roscana',
    });
  });

  it('omits the figure clause when there is only one figure in the segment', () => {
    expect(formatOwnPositionSummary({ nodeLabel: 'Vent', cordon: 1, figureName: null })).toEqual({
      nodeLabel: 'Vent',
      suffix: ' (C1)',
    });
  });

  it('states the position alone when neither cordon nor figure name is known', () => {
    expect(formatOwnPositionSummary({ nodeLabel: 'Vent', cordon: null, figureName: null })).toEqual({
      nodeLabel: 'Vent',
      suffix: '',
    });
  });

  it('never uppercases the node label — casing is the template\'s job', () => {
    expect(formatOwnPositionSummary({ nodeLabel: 'vent', cordon: null, figureName: null }).nodeLabel).toBe('vent');
  });
});

describe('the fixed strings', () => {
  it('warns about more than one placement and points at the tècnica', () => {
    expect(OWN_POSITION_MULTIPLE_PLACEMENTS).toBe(
      "Sou en més d'un lloc alhora. La comi sanitària no recomana partir-se pel mig. " +
        'Parleu amb la tècnica.',
    );
  });

  it('states plainly when there is no placement at all', () => {
    expect(OWN_POSITION_NO_PLACEMENT).toBe('No teniu cap posició en este segment.');
  });
});
