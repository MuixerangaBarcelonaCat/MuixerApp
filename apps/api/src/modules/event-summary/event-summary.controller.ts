import { Controller, Get, Param, ParseUUIDPipe, StreamableFile } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventSummaryService } from './event-summary.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class EventSummaryController {
  constructor(private readonly eventSummaryService: EventSummaryService) {}

  @Get(':id/summary.pdf')
  @ApiOperation({ summary: 'Resum imprimible de l\'esdeveniment (capçalera, notes i segments) en PDF' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Fitxer PDF adjunt' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  async getSummaryPdf(@Param('id', ParseUUIDPipe) id: string): Promise<StreamableFile> {
    const { filename, pdf } = await this.eventSummaryService.renderPdf(id);
    return new StreamableFile(pdf, {
      type: 'application/pdf',
      disposition: `attachment; filename="${filename}"`,
      length: pdf.length,
    });
  }
}
