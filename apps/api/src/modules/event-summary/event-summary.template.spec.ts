import { join } from 'path';
import { EventSummaryData, EventSummarySegment } from './build-event-summary-data';
import { EVENT_SUMMARY_TEMPLATE } from './event-summary.service';
import { CompiledTypstDocument, TypstPdfRenderer } from './typst-pdf.renderer';

/**
 * Compiles the real `event-summary.typ` with the real fonts and vendored `cmarker`. The template
 * labels what it prints (`text(...)<label>`), so these specs read the laid-out document back.
 */
const renderer = new TypstPdfRenderer(join(__dirname, '../../assets/typst'));

function makeData(overrides: Partial<EventSummaryData> = {}): EventSummaryData {
  return {
    event: {
      title: 'Assaig general',
      date: 'Dilluns, 12 d’octubre del 2026',
      startTime: '19:30',
      location: 'Local de la colla',
    },
    notes: '## Escalfament\n\nHui **pinya** i *tronc*.',
    segments: [
      {
        number: 1,
        title: 'Pd4 + 3de8',
        figures: [
          { label: 'Pd4', directions: 'Quim · Aina (X)', tronc: ['Núria - Jordi', 'Marc'] },
          { label: '3de8', directions: null, tronc: null },
        ],
      },
    ],
    ...overrides,
  };
}

function compile(data: EventSummaryData): CompiledTypstDocument {
  return renderer.compile(EVENT_SUMMARY_TEMPLATE, data);
}

describe('event-summary.typ', () => {
  describe('header', () => {
    it('sets the event title as document title and prints it', () => {
      const doc = compile(makeData());

      expect(doc.title).toBe('Assaig general');
      expect(doc.labelledTexts('event-title')).toEqual(['Assaig general']);
    });

    it('shows the app logo', () => {
      expect(compile(makeData()).count('<app-logo>')).toBe(1);
    });

    it('prints date, time and location on one line', () => {
      const doc = compile(makeData());

      expect(doc.labelledTexts('event-meta')).toEqual([
        'Dilluns, 12 d’octubre del 2026 · 19:30 · Local de la colla',
      ]);
    });

    it('leaves missing optional fields out of the line', () => {
      const data = makeData();
      const doc = compile({ ...data, event: { ...data.event, startTime: null, location: null } });

      expect(doc.labelledTexts('event-meta')).toEqual(['Dilluns, 12 d’octubre del 2026']);
    });

    // The title and the segment numbers are the only serif text.
    it('embeds the serif display font', () => {
      expect(compile(makeData()).pdf().toString('latin1')).toContain('Fraunces');
    });


    it('prints Typst syntax in user text literally', () => {
      const data = makeData();
      const doc = compile({ ...data, event: { ...data.event, title: '#panic("x") *Col·la* $a$ @ref' } });

      expect(doc.labelledTexts('event-title')).toEqual(['#panic("x") *Col·la* $a$ @ref']);
    });
  });

  describe('footer', () => {
    it('prints the event date on every page', () => {
      const segments: EventSummarySegment[] = Array.from({ length: 40 }, (_, i) => ({
        number: i + 1,
        title: `Segment ${i + 1}`,
        figures: [{ label: 'Pd4', directions: 'Quim', tronc: ['A - B', 'C'] }],
      }));

      const doc = compile(makeData({ segments }));

      expect(doc.labelledTexts('footer-date')).toEqual(
        Array.from({ length: doc.pageCount }, () => 'Dilluns, 12 d’octubre del 2026'),
      );
    });
  });

  describe('notes', () => {
    it('prints no section titles, only the content', () => {
      expect(compile(makeData()).count('<section-title>')).toBe(0);
    });

    it('never runs Typst code smuggled into the markdown', () => {
      expect(() => compile(makeData({ notes: 'Abans <!--raw-typst #panic("INJECTED") --> després' }))).not.toThrow();
    });

    it('prints an image as its alt text instead of loading a file', () => {
      expect(() => compile(makeData({ notes: 'Mireu ![la foto](/etc/passwd) i ![](missing.png)' }))).not.toThrow();
    });

    it('renders every block the editor produces', () => {
      const notes = [
        '## Títol', '### Subtítol', '**negreta** *cursiva* ~~ratllat~~ `codi`',
        '- u\n- dos\n  1. niat', '> cita', '---', '| Pis | Nom |\n| --- | --- |\n| 1 | Joan |',
      ].join('\n\n');

      expect(() => compile(makeData({ notes }))).not.toThrow();
    });

    // Atkinson Hyperlegible is reserved for the projection view.
    it('prints inline and block code without Atkinson Hyperlegible', () => {
      const notes = 'Feu `pinya` així:\n\n```\nbase\n```';

      expect(compile(makeData({ notes })).pdf().toString('latin1')).not.toContain('Atkinson');
    });
  });

  describe('segments', () => {
    it('prints each segment number and title in order', () => {
      const doc = compile(
        makeData({
          segments: [
            { number: 1, title: 'Pd4', figures: [] },
            { number: 2, title: 'Ronda final', figures: [] },
          ],
        }),
      );

      expect(doc.labelledTexts('segment-number')).toEqual(['1', '2']);
      expect(doc.labelledTexts('segment-title')).toEqual(['Pd4', 'Ronda final']);
    });

    it('separates consecutive figures of a segment with a hairline', () => {
      const figure = { label: null, directions: null, tronc: ['A - B'] };
      const doc = compile(
        makeData({
          segments: [
            { number: 1, title: '3 Pd4', figures: [figure, figure, figure] },
            { number: 2, title: 'Pd4', figures: [figure] },
          ],
        }),
      );

      expect(doc.count('<figure-separator>')).toBe(2);
    });

    it('prints each figure with its directors and tronc, skipping the missing ones', () => {
      const doc = compile(makeData());

      expect(doc.labelledTexts('figure-label')).toEqual(['Pd4', '3de8']);
      expect(doc.labelledTexts('figure-directions')).toEqual(['Quim · Aina (X)']);
      expect(doc.labelledTexts('figure-tronc')).toEqual(['Núria - Jordi', 'Marc']);
    });

    it('omits hidden figure names but still prints each figure', () => {
      const doc = compile(
        makeData({
          segments: [
            {
              number: 1,
              title: '2 Pd4',
              figures: [
                { label: null, directions: 'Quim', tronc: ['A - B'] },
                { label: null, directions: null, tronc: ['C - D'] },
              ],
            },
          ],
        }),
      );

      expect(doc.labelledTexts('figure-label')).toEqual([]);
      expect(doc.labelledTexts('figure-tronc')).toEqual(['A - B', 'C - D']);
    });

    it('says so when the event has no segments', () => {
      const doc = compile(makeData({ segments: [] }));

      expect(doc.labelledTexts('segment-title')).toEqual([]);
      expect(doc.labelledTexts('empty-segments')).toEqual(['Este esdeveniment no té segments.']);
    });

    it('flows onto further pages when the content is long', () => {
      const segments: EventSummarySegment[] = Array.from({ length: 40 }, (_, i) => ({
        number: i + 1,
        title: `Segment ${i + 1}`,
        figures: [{ label: 'Pd4', directions: 'Quim', tronc: ['A - B', 'C'] }],
      }));

      const doc = compile(makeData({ segments }));

      expect(doc.pageCount).toBeGreaterThan(1);
      expect(doc.labelledTexts('segment-title')).toHaveLength(40);
    });
  });

  describe('layout', () => {
    // Two separate column sets: the segments start at the top of a fresh pair of columns
    // below the notes, instead of continuing the notes' flow.
    it('lays out the notes in columns and the segments in a separate table', () => {
      const doc = compile(makeData());

      expect(doc.count('<notes-columns>')).toBe(1);
      expect(doc.count('<segments-table>')).toBe(1);
    });

    it('has no notes columns when there are no notes', () => {
      const doc = compile(makeData({ notes: null }));

      expect(doc.count('<notes-columns>')).toBe(0);
      expect(doc.count('<segments-table>')).toBe(1);
    });

    it('puts one segment per cell of a two-column table, filled row by row', () => {
      const segments: EventSummarySegment[] = ['A', 'B', 'C', 'D', 'E'].map((title, i) => ({
        number: i + 1,
        title,
        figures: [],
      }));

      const doc = compile(makeData({ segments }));

      const [columns] = doc.fieldOf('segments-table', 'columns') as unknown[][];
      expect(columns).toHaveLength(2);
      expect(doc.textsWithin('segments-table').filter((t) => /^[A-E1-5]$/.test(t))).toEqual([
        '1', 'A', '2', 'B', '3', 'C', '4', 'D', '5', 'E',
      ]);
    });

    it('centres the text within each segment cell', () => {
      expect(String(compile(makeData()).fieldOf('segments-table', 'align')[0])).toContain('center');
    });

    it('prints no table when there are no segments', () => {
      expect(compile(makeData({ segments: [] })).count('<segments-table>')).toBe(0);
    });
  });

  // Typst's columns never balance (typst#466), so the template splits the notes itself.
  describe('balanced notes', () => {
    const paragraph = (word: string) => `${word} `.repeat(60).trim();

    it('splits short notes between the two columns', () => {
      const doc = compile(makeData({ notes: '## Primer\n\nText u.\n\n## Segon\n\nText dos.' }));

      expect(doc.textsWithin('notes-left')).toEqual(expect.arrayContaining(['Primer']));
      expect(doc.textsWithin('notes-left')).not.toContain('Segon');
      expect(doc.textsWithin('notes-right')).toEqual(expect.arrayContaining(['Segon']));
    });

    it('never leaves a heading at the bottom of the left column', () => {
      const notes = `${paragraph('abans')}\n\n## Títol\n\n${paragraph('després')}`;

      const doc = compile(makeData({ notes }));

      expect(doc.textsWithin('notes-left')).not.toContain('Títol');
      expect(doc.textsWithin('notes-right')).toContain('Títol');
    });

    it('keeps a single block in the left column', () => {
      const doc = compile(makeData({ notes: 'Només un paràgraf.' }));

      expect(doc.textsWithin('notes-left').join('')).toContain('Només un paràgraf');
      expect(doc.textsWithin('notes-right')).toEqual([]);
    });

    it('lets notes too long for the rest of the page flow through ordinary columns', () => {
      const notes = Array.from({ length: 80 }, (_, i) => paragraph(`p${i}`)).join('\n\n');

      const doc = compile(makeData({ notes }));

      expect(doc.count('<notes-columns>')).toBe(1);
      expect(doc.count('<notes-left>')).toBe(0);
      expect(doc.pageCount).toBeGreaterThan(1);
    });
  });

  it('exports a PDF', () => {
    expect(compile(makeData()).pdf().subarray(0, 5).toString('latin1')).toBe('%PDF-');
  });
});
