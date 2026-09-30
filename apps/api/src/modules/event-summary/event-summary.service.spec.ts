import { NotFoundException } from '@nestjs/common';
import { EventType, FigureMode } from '@muixer/shared';
import { EventService } from '../event/event.service';
import { EventSegmentService } from '../event-segment/event-segment.service';
import { NodeAssignmentService } from '../node-assignment/node-assignment.service';
import { EVENT_SUMMARY_TEMPLATE, EventSummaryService } from './event-summary.service';
import { CompiledTypstDocument, TypstPdfRenderer } from './typst-pdf.renderer';

const PDF = Buffer.from('%PDF-fake');

describe('EventSummaryService', () => {
  let service: EventSummaryService;
  let eventService: { findOne: jest.Mock };
  let segmentService: { findAllByEvent: jest.Mock; getTroncView: jest.Mock };
  let assignmentService: { getEventAssignmentSummary: jest.Mock };
  let renderer: { compile: jest.Mock };

  const event = {
    id: 'ev-1',
    title: 'Assaig general — «Col·la»!',
    eventType: EventType.ASSAIG,
    date: '2026-10-12',
    startTime: '19:30',
    location: null,
    season: null,
    notes: 'Hui **pinya**',
  };

  beforeEach(() => {
    eventService = { findOne: jest.fn().mockResolvedValue(event) };
    segmentService = {
      findAllByEvent: jest.fn().mockResolvedValue([
        {
          id: 'seg-1',
          name: null,
          sortOrder: 0,
          instances: [
            { id: 'i1', label: null, sortOrder: 0, figureMode: FigureMode.COMPLETA, figureTemplate: { id: 't', name: 'Pd4', hasPinya: true } },
          ],
        },
      ]),
      getTroncView: jest.fn().mockResolvedValue([{ instanceId: 'i1', floors: [{ z: 1, isBase: false, slots: ['Joan'] }] }]),
    };
    assignmentService = {
      getEventAssignmentSummary: jest.fn().mockResolvedValue({
        segments: [{ figures: [{ instanceId: 'i1', directions: [{ positionType: 'direccio-tronc', personAlias: 'Quim' }] }] }],
      }),
    };
    renderer = { compile: jest.fn().mockReturnValue({ pdf: () => PDF } as unknown as CompiledTypstDocument) };

    service = new EventSummaryService(
      eventService as unknown as EventService,
      segmentService as unknown as EventSegmentService,
      assignmentService as unknown as NodeAssignmentService,
      renderer as unknown as TypstPdfRenderer,
    );
  });

  it('fetches every source for the event', async () => {
    await service.renderPdf('ev-1');

    expect(eventService.findOne).toHaveBeenCalledWith('ev-1');
    expect(segmentService.findAllByEvent).toHaveBeenCalledWith('ev-1');
    expect(segmentService.getTroncView).toHaveBeenCalledWith('ev-1');
    expect(assignmentService.getEventAssignmentSummary).toHaveBeenCalledWith('ev-1');
  });

  it('compiles the event summary template with the assembled data', async () => {
    await service.renderPdf('ev-1');

    expect(renderer.compile).toHaveBeenCalledWith(
      EVENT_SUMMARY_TEMPLATE,
      expect.objectContaining({
        notes: 'Hui **pinya**',
        segments: [{ number: 1, title: 'Pd4', figures: [{ label: null, directions: 'Quim', tronc: ['Joan'] }] }],
      }),
    );
  });

  it('returns the PDF bytes', async () => {
    expect((await service.renderPdf('ev-1')).pdf).toBe(PDF);
  });

  it('names the file after the date and an ASCII slug of the title', async () => {
    expect((await service.renderPdf('ev-1')).filename).toBe('2026-10-12-assaig-general-colla.pdf');
  });

  it('falls back to a generic name when the title has no letters or digits', async () => {
    eventService.findOne.mockResolvedValue({ ...event, title: '— «» !' });

    expect((await service.renderPdf('ev-1')).filename).toBe('2026-10-12-esdeveniment.pdf');
  });

  it('propagates a missing event without rendering', async () => {
    eventService.findOne.mockRejectedValue(new NotFoundException());

    await expect(service.renderPdf('missing')).rejects.toBeInstanceOf(NotFoundException);
    expect(renderer.compile).not.toHaveBeenCalled();
  });
});
