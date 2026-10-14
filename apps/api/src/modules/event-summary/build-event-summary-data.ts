import {
  computeInstanceDisplayNames,
  computeSegmentDisplayName,
  EventFigureSummary,
  formatDirectionNames,
  formatTroncFloors,
  getSegmentInstanceLabel,
  FigureMode,
} from '@muixer/shared';
import { EventDetailItem } from '../event/event.service';
import { InstanceRef, InstanceTroncSummary, SegmentWithInstances } from '../event-segment/event-segment.service';
import { titleCaseName } from './title-case-name';

/**
 * Exactly the data the `event-summary.typ` template reads — serialised to JSON and handed to
 * Typst as data (never interpolated into the source), so user text can't inject markup.
 */
export interface EventSummaryData {
  event: {
    title: string;
    /** Long Catalan date, e.g. «Dilluns, 12 d’octubre del 2026». */
    date: string;
    startTime: string | null;
    location: string | null;
  };
  /** Raw markdown; the template renders it with the vendored `cmarker` package. */
  notes: string | null;
  segments: EventSummarySegment[];
}

export interface EventSummarySegment {
  /** 1-based position in the event, as the segment list shows it. */
  number: number;
  title: string;
  figures: EventSummaryFigure[];
}

interface EventSummaryFigure {
  /**
   * Null when the derived segment title already says it all: a single figure, or every figure
   * the same («2 Pd4»). Kept when the segment has a name of its own. The template then separates the figures with an empty line instead.
   */
  label: string | null;
  /** «Quim · Aina (X) · Pep (P)», the same line as the segment list's Troncs mode. */
  directions: string | null;
  /**
   * One line per floor, base → top («A - B», «C»). A pinet — one person per floor — stays on a
   * single «A // B // C» line instead of a tall column of single names.
   */
  tronc: string[] | null;
}

/** Only the fields the summary reads, so callers (and specs) needn't build full API payloads. */
export interface EventSummaryInput {
  event: Pick<EventDetailItem, 'title' | 'date' | 'startTime' | 'location' | 'notes'>;
  segments: (Pick<SegmentWithInstances, 'id' | 'name' | 'sortOrder'> & {
    instances: Pick<InstanceRef, 'id' | 'label' | 'sortOrder' | 'figureMode' | 'figureTemplate'>[];
  })[];
  troncView: InstanceTroncSummary[];
  assignmentSummary: {
    segments: { figures: Pick<EventFigureSummary, 'instanceId' | 'directions'>[] }[];
  };
}

const longDateFormatter = new Intl.DateTimeFormat('ca-ES', {
  timeZone: 'Europe/Madrid',
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «Dilluns, 12 d’octubre del 2026»: Intl gives the weekday in lower case. */
function formatLongDate(date: Date): string {
  const text = longDateFormatter.format(date);
  return text.charAt(0).toLocaleUpperCase('ca-ES') + text.slice(1);
}

export function buildEventSummaryData(input: EventSummaryInput): EventSummaryData {
  const { event } = input;
  const floorsByInstance = new Map(input.troncView.map((t) => [t.instanceId, t.floors]));
  const directionsByInstance = new Map(
    input.assignmentSummary.segments.flatMap((s) => s.figures).map((f) => [f.instanceId, f.directions]),
  );

  const segments = bySortOrder(input.segments).map((segment, index) => {
    const instances = bySortOrder(segment.instances);
    const labels = computeInstanceDisplayNames(instances);
    // A segment with its own name («Ronda final») doesn't say which figures it holds, so only a
    // derived title can make the figure names redundant.
    const hideLabels = segment.name === null && new Set(instances.map(getSegmentInstanceLabel)).size <= 1;
    return {
      number: index + 1,
      title: computeSegmentDisplayName(segment.name, instances),
      figures: instances.map((instance) => {
        const directions = formatDirectionNames(directionsByInstance.get(instance.id) ?? []).map(titleCaseName);
        return {
          label: hideLabels ? null : (labels.get(instance.id) ?? '?'),
          directions: directions.length ? directions.join(' · ') : null,
          tronc: troncLines(floorsByInstance.get(instance.id) ?? [], instance.figureMode),
        };
      }),
    };
  });

  return {
    event: {
      title: event.title,
      date: formatLongDate(new Date(event.date)),
      startTime: event.startTime,
      location: event.location,
    },
    notes: event.notes?.trim() ? event.notes : null,
    segments,
  };
}

function bySortOrder<T extends { sortOrder: number }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder);
}

function troncLines(floors: InstanceTroncSummary['floors'], figureMode: `${FigureMode}`): string[] | null {
  const lines = formatTroncFloors(
    floors.map((f) => ({ ...f, slots: f.slots.map((s) => (s === null ? null : titleCaseName(s))) })),
    figureMode,
  );
  // REMAT doesn't show the base, so its width can't make the figure "not a pinet".
  const shown = figureMode === FigureMode.REMAT ? floors.filter((f) => !f.isBase) : floors;
  const isPinet = shown.every((f) => f.slots.length === 1);
  return lines && isPinet ? [lines.join(' // ')] : lines;
}
