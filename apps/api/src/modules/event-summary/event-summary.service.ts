import { Injectable } from '@nestjs/common';
import { formatDateOnly } from '../../common/utils/date.util';
import { EventService } from '../event/event.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import { buildEventSummaryData } from './build-event-summary-data';
import { TypstPdfRenderer } from './typst-pdf.renderer';

/** Template file, relative to `TYPST_ASSETS_DIR`. */
export const EVENT_SUMMARY_TEMPLATE = 'event-summary.typ';

export interface EventSummaryPdf {
  filename: string;
  pdf: Buffer;
}

@Injectable()
export class EventSummaryService {
  constructor(
    private readonly eventService: EventService,
    private readonly segmentService: EventSegmentService,
    private readonly assignmentService: NodeAssignmentService,
    private readonly renderer: TypstPdfRenderer,
  ) {}

  /** Printable summary of an event: header, notes and segments in two columns. 404s via `findOne`. */
  async renderPdf(eventId: string): Promise<EventSummaryPdf> {
    const event = await this.eventService.findOne(eventId);
    const [segments, troncView, assignmentSummary] = await Promise.all([
      this.segmentService.findAllByEvent(eventId),
      this.segmentService.getTroncView(eventId),
      this.assignmentService.getEventAssignmentSummary(eventId),
    ]);

    const data = buildEventSummaryData({ event, segments, troncView, assignmentSummary });
    const pdf = this.renderer.compile(EVENT_SUMMARY_TEMPLATE, data).pdf();

    return { filename: `${formatDateOnly(event.date)}-${slugify(event.title)}.pdf`, pdf };
  }
}

/** ASCII-only so the filename needs no RFC 5987 encoding in `Content-Disposition`. */
function slugify(title: string): string {
  const slug = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    // Catalan «l·l» → «ll», not «l-l».
    .replace(/·/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'esdeveniment';
}
