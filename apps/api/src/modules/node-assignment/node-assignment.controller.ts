import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@muixer/shared';
import { NodeAssignmentService } from './node-assignment.service';
import { AvailablePersonsService, AvailablePersonsQuery } from './available-persons.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';
import { BulkImportAssignmentDto } from './dto/bulk-import-assignment.dto';
import { SwapAssignmentsDto } from './dto/swap-assignments.dto';
import { UpdateInstanceCordonsDto } from './dto/update-instance-cordons.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@ApiTags('node-assignments')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller()
export class NodeAssignmentController {
  constructor(
    private readonly assignmentService: NodeAssignmentService,
    private readonly availablePersonsService: AvailablePersonsService,
  ) {}

  @ApiOperation({ summary: 'Get nodes for a figure instance (live template or snapshot)' })
  @Get('figure-instances/:instanceId/nodes')
  async getInstanceNodes(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    const data = await this.assignmentService.getInstanceNodes(instanceId);
    return { data };
  }

  @ApiOperation({ summary: 'List all assignments for a figure instance' })
  @Get('figure-instances/:instanceId/assignments')
  async getByInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    const data = await this.assignmentService.getByInstance(instanceId);
    return { data };
  }

  @ApiOperation({ summary: 'Assign a person to a node in a figure instance (auto-snapshots on first assignment)' })
  @Post('figure-instances/:instanceId/assignments')
  assign(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    return this.assignmentService.assign(instanceId, dto);
  }

  @ApiOperation({ summary: 'Swap two assignments within the same figure instance' })
  @Post('figure-instances/:instanceId/assignments/swap')
  swap(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: SwapAssignmentsDto,
  ) {
    return this.assignmentService.swap(instanceId, dto);
  }

  @ApiOperation({ summary: 'Remove an assignment from a figure instance' })
  @Delete('figure-instances/:instanceId/assignments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  unassign(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.assignmentService.unassign(instanceId, id);
  }

  @ApiOperation({ summary: 'Bulk import assignments from a previous figure instance' })
  @Post('figure-instances/:instanceId/assignments/bulk')
  @HttpCode(HttpStatus.MULTI_STATUS)
  bulkImport(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: BulkImportAssignmentDto,
  ) {
    return this.assignmentService.bulkImport(instanceId, dto);
  }

  @ApiOperation({ summary: 'Update cordon configuration (numberOfCordons, openCordons) for a figure instance' })
  @Patch('figure-instances/:instanceId/cordons')
  updateCordons(
    @Param('instanceId', ParseUUIDPipe) instanceId: string,
    @Body() dto: UpdateInstanceCordonsDto,
  ) {
    return this.assignmentService.updateCordons(instanceId, dto);
  }

  @ApiOperation({ summary: 'Upgrade instance to the next variant in its family (adds cordon nodes)' })
  @Post('figure-instances/:instanceId/upgrade')
  upgradeInstance(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.assignmentService.upgradeInstance(instanceId);
  }

  @ApiOperation({ summary: 'Reset snapshot: remove all assignments and instance nodes, revert to live template' })
  @Post('figure-instances/:instanceId/reset')
  resetSnapshot(@Param('instanceId', ParseUUIDPipe) instanceId: string) {
    return this.assignmentService.resetSnapshot(instanceId);
  }

  @ApiOperation({ summary: 'Get available persons for assignment in a segment' })
  @Get('events/:eventId/segments/:segmentId/available-persons')
  async getAvailablePersons(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Query() query: AvailablePersonsQuery,
  ) {
    const data = await this.availablePersonsService.getAvailablePersons(eventId, segmentId, query);
    return { data };
  }

  @ApiOperation({ summary: 'Get figure instance assignment history for a template' })
  @Get('figure-templates/:templateId/history')
  async getHistory(
    @Param('templateId', ParseUUIDPipe) templateId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.assignmentService.getHistory(templateId, query);
  }

  @ApiOperation({ summary: 'Get assignment lock status for an event' })
  @Get('events/:eventId/lock-status')
  getLockStatus(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.assignmentService.getLockStatus(eventId);
  }

  @ApiOperation({ summary: 'Get the next performance event after the given event' })
  @Get('events/:eventId/next-performance')
  getNextPerformance(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.availablePersonsService.getNextPerformance(eventId);
  }

  @ApiOperation({ summary: 'Get assignment history for a person' })
  @Get('persons/:personId/assignment-history')
  getPersonHistory(
    @Param('personId', ParseUUIDPipe) personId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.assignmentService.getPersonHistory(personId, query);
  }

  @ApiOperation({ summary: 'Get assignment summary for all figures in an event' })
  @Get('events/:eventId/assignment-summary')
  getEventAssignmentSummary(@Param('eventId', ParseUUIDPipe) eventId: string) {
    return this.assignmentService.getEventAssignmentSummary(eventId);
  }

  @ApiOperation({ summary: 'Get assignment history for all variants in a figure family' })
  @Get('figure-families/:familyId/history')
  getFamilyHistory(
    @Param('familyId', ParseUUIDPipe) familyId: string,
    @Query() query: HistoryQueryDto,
  ) {
    return this.assignmentService.getFamilyHistory(familyId, query);
  }
}
