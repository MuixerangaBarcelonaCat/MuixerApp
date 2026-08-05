import {
  Controller,
  Get,
  Put,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import {
  JwtPayload,
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  AttendanceResponse,
  UserRole,
} from '@muixer/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { MeService } from './me.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';

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
}
