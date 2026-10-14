import { FigureMode } from '@muixer/shared';
import { buildEventSummaryData, EventSummaryInput } from './build-event-summary-data';

type SegmentInput = EventSummaryInput['segments'][number];
type InstanceInput = SegmentInput['instances'][number];
type FigureSummaryInput = EventSummaryInput['assignmentSummary']['segments'][number]['figures'][number];

function makeInstance(overrides: Partial<InstanceInput> = {}): InstanceInput {
  return {
    id: 'inst-1',
    label: null,
    sortOrder: 0,
    figureMode: FigureMode.COMPLETA,
    figureTemplate: { id: 'tpl-1', name: 'Pd4', hasPinya: true },
    ...overrides,
  };
}

function makeSegment(overrides: Partial<SegmentInput> = {}): SegmentInput {
  return { id: 'seg-1', name: null, sortOrder: 0, instances: [makeInstance()], ...overrides };
}

function makeInput(overrides: Partial<EventSummaryInput> = {}): EventSummaryInput {
  return {
    event: {
      title: 'Assaig general',
      date: '2026-10-12' as unknown as Date,
      startTime: '19:30',
      location: 'Local de la colla',
      notes: '## Escalfament\n\nHui **pinya**.',
    },
    segments: [makeSegment()],
    troncView: [],
    assignmentSummary: { segments: [] },
    ...overrides,
  };
}

function withDirections(instanceId: string, directions: FigureSummaryInput['directions']): EventSummaryInput['assignmentSummary'] {
  return { segments: [{ figures: [{ instanceId, directions }] }] };
}

describe('buildEventSummaryData', () => {
  describe('event header', () => {
    it('copies title, date, start time and location, and nothing else', () => {
      expect(buildEventSummaryData(makeInput()).event).toEqual({
        title: 'Assaig general',
        date: 'Dilluns, 12 d’octubre del 2026',
        startTime: '19:30',
        location: 'Local de la colla',
      });
    });

    it('formats the date as a long Catalan date, capitalised', () => {
      expect(buildEventSummaryData(makeInput()).event.date).toBe('Dilluns, 12 d’octubre del 2026');
    });

    it('keeps the calendar day when the date arrives as a Date at UTC midnight', () => {
      const input = makeInput({ event: { ...makeInput().event, date: new Date('2026-10-12T00:00:00.000Z') } });

      expect(buildEventSummaryData(input).event.date).toBe('Dilluns, 12 d’octubre del 2026');
    });

    it('returns null for missing optional fields', () => {
      const input = makeInput({
        event: { ...makeInput().event, startTime: null, location: null },
      });

      const { event } = buildEventSummaryData(input);

      expect(event.startTime).toBeNull();
      expect(event.location).toBeNull();
    });
  });

  describe('notes', () => {
    it('passes the markdown through untouched (the template renders it)', () => {
      expect(buildEventSummaryData(makeInput()).notes).toBe('## Escalfament\n\nHui **pinya**.');
    });

    it('returns null for empty or whitespace-only notes', () => {
      expect(buildEventSummaryData(makeInput({ event: { ...makeInput().event, notes: null } })).notes).toBeNull();
      expect(buildEventSummaryData(makeInput({ event: { ...makeInput().event, notes: '  \n ' } })).notes).toBeNull();
    });
  });

  describe('segments', () => {
    it('numbers segments from 1 in sortOrder, regardless of input order', () => {
      const input = makeInput({
        segments: [
          makeSegment({ id: 'seg-b', name: 'Segon', sortOrder: 1 }),
          makeSegment({ id: 'seg-a', name: 'Primer', sortOrder: 0 }),
        ],
      });

      const { segments } = buildEventSummaryData(input);

      expect(segments.map((s) => [s.number, s.title])).toEqual([
        [1, 'Primer'],
        [2, 'Segon'],
      ]);
    });

    it('derives the title from its figures when the segment has no name', () => {
      const input = makeInput({
        segments: [
          makeSegment({
            instances: [
              makeInstance({ id: 'i1', sortOrder: 0 }),
              makeInstance({ id: 'i2', sortOrder: 1 }),
              makeInstance({ id: 'i3', sortOrder: 2, figureTemplate: { id: 't2', name: '3de8', hasPinya: true } }),
            ],
          }),
        ],
      });

      expect(buildEventSummaryData(input).segments[0].title).toBe('2 Pd4 + 3de8');
    });

    it('keeps a segment with no figures, with an empty figure list', () => {
      const input = makeInput({ segments: [makeSegment({ name: 'Descans', instances: [] })] });

      expect(buildEventSummaryData(input).segments[0]).toEqual({ number: 1, title: 'Descans', figures: [] });
    });

    it('returns no segments when the event has none', () => {
      expect(buildEventSummaryData(makeInput({ segments: [] })).segments).toEqual([]);
    });
  });

  describe('figures', () => {
    it('lists figures in sortOrder, numbering duplicate labels', () => {
      const input = makeInput({
        segments: [
          makeSegment({
            instances: [
              makeInstance({ id: 'i2', sortOrder: 1 }),
              makeInstance({ id: 'i1', sortOrder: 0 }),
              makeInstance({ id: 'i3', sortOrder: 2, figureMode: FigureMode.PEU }),
            ],
          }),
        ],
      });

      const labels = buildEventSummaryData(input).segments[0].figures.map((f) => f.label);

      expect(labels).toEqual(['Pd4 1', 'Pd4 2', 'Peu de Pd4']);
    });

    it('hides the figure name when the segment has a single figure', () => {
      expect(buildEventSummaryData(makeInput()).segments[0].figures[0].label).toBeNull();
    });

    it('hides the figure names when every figure in the segment is the same', () => {
      const input = makeInput({
        segments: [makeSegment({ instances: [makeInstance({ id: 'i1', sortOrder: 0 }), makeInstance({ id: 'i2', sortOrder: 1 })] })],
      });

      expect(buildEventSummaryData(input).segments[0].figures.map((f) => f.label)).toEqual([null, null]);
    });

    it('keeps the figure name when the segment has a name of its own', () => {
      const input = makeInput({ segments: [makeSegment({ name: 'Ronda final' })] });

      expect(buildEventSummaryData(input).segments[0].figures[0].label).toBe('Pd4');
    });

    it('keeps the figure names when the figures differ', () => {
      const input = makeInput({
        segments: [
          makeSegment({
            instances: [
              makeInstance({ id: 'i1', sortOrder: 0 }),
              makeInstance({ id: 'i2', sortOrder: 1, figureTemplate: { id: 't2', name: '3de8', hasPinya: true } }),
            ],
          }),
        ],
      });

      expect(buildEventSummaryData(input).segments[0].figures.map((f) => f.label)).toEqual(['Pd4', '3de8']);
    });

    it('joins the figure directors in slot order with markers', () => {
      const input = makeInput({
        assignmentSummary: withDirections('inst-1', [
          { positionType: 'direccio-pinya', personAlias: 'Pep' },
          { positionType: 'direccio-tronc', personAlias: 'Quim' },
          { positionType: 'direccio-xicalla', personAlias: 'Aina' },
        ]),
      });

      expect(buildEventSummaryData(input).segments[0].figures[0].directions).toBe('Quim · Aina (X) · Pep (P)');
    });

    it('returns null directions when the figure has no directors or no summary', () => {
      expect(buildEventSummaryData(makeInput()).segments[0].figures[0].directions).toBeNull();

      const empty = makeInput({ assignmentSummary: withDirections('inst-1', []) });
      expect(buildEventSummaryData(empty).segments[0].figures[0].directions).toBeNull();
    });

    const withFloors = (floors: { z: number; isBase: boolean; slots: (string | null)[] }[], figureMode = FigureMode.COMPLETA) =>
      makeInput({
        segments: [makeSegment({ instances: [makeInstance({ figureMode })] })],
        troncView: [{ instanceId: 'inst-1', floors }],
      });

    it('puts each tronc floor on its own line, base to top', () => {
      const input = withFloors([
        { z: 1, isBase: false, slots: ['Joan', null] },
        { z: 0, isBase: true, slots: ['Pepet', 'Maria', 'Nil'] },
      ]);

      expect(buildEventSummaryData(input).segments[0].figures[0].tronc).toEqual(['Pepet - Maria - Nil', 'Joan - ?']);
    });

    it('keeps a pinet (one person per floor) on a single line joined by «//»', () => {
      const input = withFloors([
        { z: 0, isBase: true, slots: ['Pepet'] },
        { z: 1, isBase: false, slots: ['Joan'] },
        { z: 2, isBase: false, slots: [null] },
      ]);

      expect(buildEventSummaryData(input).segments[0].figures[0].tronc).toEqual(['Pepet // Joan // ?']);
    });

    it('title-cases all-caps names in the tronc and the directors', () => {
      const input = {
        ...withFloors([
          { z: 0, isBase: true, slots: ['PEPET', 'MARIA'] },
          { z: 1, isBase: false, slots: ['JOAN (A)', null] },
        ]),
        assignmentSummary: withDirections('inst-1', [
          { positionType: 'direccio-tronc', personAlias: 'QUIM' },
          { positionType: 'direccio-xicalla', personAlias: 'AINA' },
        ]),
      };

      const [figure] = buildEventSummaryData(input).segments[0].figures;

      expect(figure.tronc).toEqual(['Pepet - Maria', 'Joan (A) - ?']);
      expect(figure.directions).toBe('Quim · Aina (X)');
    });

    it('respects the figure mode', () => {
      const input = withFloors(
        [
          { z: 0, isBase: true, slots: ['Pepet', null] },
          { z: 1, isBase: false, slots: ['Joan'] },
        ],
        FigureMode.REMAT,
      );

      expect(buildEventSummaryData(input).segments[0].figures[0].tronc).toEqual(['Joan']);
    });

    it('returns null tronc when the figure has no tronc data', () => {
      expect(buildEventSummaryData(makeInput()).segments[0].figures[0].tronc).toBeNull();
    });
  });
});
