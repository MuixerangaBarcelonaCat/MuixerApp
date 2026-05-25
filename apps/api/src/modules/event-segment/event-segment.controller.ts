import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@muixer/shared';
import { EventSegmentService } from './event-segment.service';
import { FigureInstanceService } from './figure-instance.service';
import { ProjectionService, ProjectionData } from './projection.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { ReorderSegmentsDto } from './dto/reorder-segments.dto';
import { CreateInstanceDto } from './dto/create-instance.dto';
import { UpdateInstanceDto } from './dto/update-instance.dto';
import { ReorderInstancesDto } from './dto/reorder-instances.dto';
import { UpdateProjectionLayoutDto } from './dto/update-projection-layout.dto';

@ApiTags('event-segments')
@ApiBearerAuth()
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
@Controller('events/:eventId/segments')
export class EventSegmentController {
  constructor(
    private readonly segmentService: EventSegmentService,
    private readonly instanceService: FigureInstanceService,
    private readonly projectionService: ProjectionService,
  ) {}

  @ApiOperation({ summary: 'List segments for an event, ordered by sortOrder, with instances' })
  @Get()
  async findAll(@Param('eventId', ParseUUIDPipe) eventId: string) {
    const data = await this.segmentService.findAllByEvent(eventId);
    return { data };
  }

  @ApiOperation({ summary: 'Create a new segment for an event' })
  @Post()
  create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateSegmentDto,
  ) {
    return this.segmentService.create(eventId, dto);
  }

  @ApiOperation({ summary: 'Reorder segments by providing an ordered array of segment IDs' })
  @Patch('reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderSegments(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: ReorderSegmentsDto,
  ): Promise<void> {
    return this.segmentService.reorder(eventId, dto);
  }

  @ApiOperation({ summary: 'Update a segment name, times, notes or visibility' })
  @Put(':id')
  updateSegment(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSegmentDto,
  ) {
    return this.segmentService.update(eventId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a segment and all its figure instances (CASCADE)' })
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeSegment(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.segmentService.remove(eventId, id);
  }

  @ApiOperation({ summary: 'Add a figure template or composition template to a segment' })
  @Post(':segmentId/instances')
  createInstance(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Body() dto: CreateInstanceDto,
  ) {
    return this.instanceService.create(eventId, segmentId, dto);
  }

  @ApiOperation({ summary: 'Reorder figure instances within a segment' })
  @Patch(':segmentId/instances/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderInstances(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Body() dto: ReorderInstancesDto,
  ): Promise<void> {
    return this.instanceService.reorder(eventId, segmentId, dto);
  }

  @ApiOperation({ summary: 'Update a figure instance label or sortOrder' })
  @Put(':segmentId/instances/:id')
  updateInstance(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstanceDto,
  ) {
    return this.instanceService.update(eventId, segmentId, id, dto);
  }

  @ApiOperation({ summary: 'Remove a figure instance from a segment' })
  @Delete(':segmentId/instances/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeInstance(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.instanceService.remove(eventId, segmentId, id);
  }

  @ApiOperation({ summary: 'Batch update projection positions for all instances in a segment' })
  @Put(':segmentId/instances/projection-layout')
  @HttpCode(HttpStatus.NO_CONTENT)
  updateProjectionLayout(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
    @Body() dto: UpdateProjectionLayoutDto,
  ): Promise<void> {
    return this.instanceService.updateProjectionLayout(eventId, segmentId, dto);
  }

  @ApiOperation({ summary: 'Get all projection data for a segment (instances with nodes, assignments, reference elements)' })
  @Get(':segmentId/projection')
  getProjection(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
  ): Promise<ProjectionData> {
    return this.projectionService.getProjection(eventId, segmentId);
  }
}
