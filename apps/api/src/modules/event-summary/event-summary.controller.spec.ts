import { StreamableFile } from '@nestjs/common';
import { UserRole } from '@muixer/shared';
import { ROLES_KEY } from '../auth/constants/auth.constants';
import { EventSummaryController } from './event-summary.controller';
import { EventSummaryService } from './event-summary.service';

describe('EventSummaryController', () => {
  const pdf = Buffer.from('%PDF-fake');
  let service: { renderPdf: jest.Mock };
  let controller: EventSummaryController;

  beforeEach(() => {
    service = { renderPdf: jest.fn().mockResolvedValue({ filename: '2026-10-12-assaig.pdf', pdf }) };
    controller = new EventSummaryController(service as unknown as EventSummaryService);
  });

  it('renders the summary of the requested event', async () => {
    await controller.getSummaryPdf('ev-1');

    expect(service.renderPdf).toHaveBeenCalledWith('ev-1');
  });

  it('streams the PDF as a download named after the event', async () => {
    const file = await controller.getSummaryPdf('ev-1');

    expect(file).toBeInstanceOf(StreamableFile);
    expect(file.getHeaders()).toEqual(
      expect.objectContaining({
        type: 'application/pdf',
        disposition: 'attachment; filename="2026-10-12-assaig.pdf"',
        length: pdf.length,
      }),
    );
  });

  it('is restricted to technicians and admins (members never see internal notes)', () => {
    expect(Reflect.getMetadata(ROLES_KEY, EventSummaryController)).toEqual([UserRole.TECHNICAL, UserRole.ADMIN]);
  });
});
