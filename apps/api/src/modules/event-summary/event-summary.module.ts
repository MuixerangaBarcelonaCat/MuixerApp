import { Module } from '@nestjs/common';
import { join } from 'path';
import { EventModule } from '../event/event.module';
import { EventSegmentModule } from '../event-segment/event-segment.module';
import { NodeAssignmentModule } from '../node-assignment/node-assignment.module';
import { EventSummaryController } from './event-summary.controller';
import { EventSummaryService } from './event-summary.service';
import { TYPST_ASSETS_DIR, TypstPdfRenderer } from './typst-pdf.renderer';

@Module({
  imports: [EventModule, EventSegmentModule, NodeAssignmentModule],
  controllers: [EventSummaryController],
  providers: [
    EventSummaryService,
    TypstPdfRenderer,
    // The webpack bundle runs as `dist/apps/api/main.js` (`/app/main.js` in Docker), with
    // `apps/api/src/assets` copied next to it.
    { provide: TYPST_ASSETS_DIR, useFactory: () => join(__dirname, 'assets', 'typst') },
  ],
})
export class EventSummaryModule {}
