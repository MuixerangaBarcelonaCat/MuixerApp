import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  JwtPayload,
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  MeSegment,
  AttendanceResponse,
  PendingDependent,
  UserRole,
} from '@muixer/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectionData } from '../event-segment/projection.service';
import { MeService } from './me.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';
import { DependentRegistrationDto } from './dto/dependent-registration.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@Roles(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN)
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get('events')
  @ApiOperation({ summary: 'List events for authenticated member (current season)' })
  findEvents(
    @CurrentUser() user: JwtPayload,
    @Query() filters: MeEventFilterDto,
  ): Promise<PaginatedResponse<MeEvent>> {
    return this.meService.findEvents(user, filters);
  }

  @Get('events/:id')
  @ApiOperation({ summary: 'Get event detail for authenticated member' })
  findEventDetail(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeEventDetail> {
    return this.meService.findEventDetail(user, id);
  }

  @Put('events/:id/attendance')
  @ApiOperation({ summary: 'Upsert attendance for authenticated member' })
  upsertAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMyAttendanceDto,
  ): Promise<AttendanceResponse> {
    return this.meService.upsertAttendance(user, id, dto);
  }

  @Get('events/:eventId/segments')
  @ApiOperation({ summary: 'List published segments for an event (titles only)' })
  findEventSegments(
    @CurrentUser() user: JwtPayload,
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Promise<MeSegment[]> {
    return this.meService.findEventSegments(user, eventId);
  }

  @Get('events/:eventId/segments/:segmentId/projection')
  @ApiOperation({ summary: 'Get projection data for a published segment' })
  findSegmentProjection(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Param('segmentId', ParseUUIDPipe) segmentId: string,
  ): Promise<ProjectionData> {
    return this.meService.findSegmentProjection(eventId, segmentId);
  }

  @Get('pending-dependents')
  @ApiOperation({ summary: 'List provisional Xicalla the caller is the primary delegate for' })
  getPendingDependents(@CurrentUser() user: JwtPayload): Promise<PendingDependent[]> {
    return this.meService.getPendingDependents(user.sub);
  }

  @Post('pending-dependents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Complete registration data for one pending dependent' })
  completePendingDependent(
    @CurrentUser() user: JwtPayload,
    @Body() dto: DependentRegistrationDto,
  ): Promise<void> {
    return this.meService.completePendingDependent(user.sub, dto);
  }
}
