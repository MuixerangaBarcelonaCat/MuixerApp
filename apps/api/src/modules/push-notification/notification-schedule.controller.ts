import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtPayload, PaginatedResponse, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { NotificationScheduleService, NotificationScheduleWithNextRun } from './notification-schedule.service';
import { NotificationSchedule } from './entities/notification-schedule.entity';
import { CreateNotificationScheduleDto } from './dto/create-notification-schedule.dto';
import { UpdateNotificationScheduleDto } from './dto/update-notification-schedule.dto';
import { NotificationScheduleFilterDto } from './dto/notification-schedule-filter.dto';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications/schedules')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class NotificationScheduleController {
  constructor(private readonly scheduleService: NotificationScheduleService) {}

  @Post()
  @ApiOperation({ summary: 'Schedule a notification to be dispatched later' })
  create(
    @Body() dto: CreateNotificationScheduleDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<NotificationSchedule> {
    return this.scheduleService.create(dto, user.sub);
  }

  @Get()
  @ApiOperation({ summary: 'List scheduled notifications' })
  findAll(@Query() filter: NotificationScheduleFilterDto): Promise<PaginatedResponse<NotificationScheduleWithNextRun>> {
    return this.scheduleService.findAll(filter);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single scheduled notification' })
  findOne(@Param('id') id: string): Promise<NotificationScheduleWithNextRun> {
    return this.scheduleService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a pending scheduled notification' })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationScheduleDto,
  ): Promise<NotificationSchedule> {
    return this.scheduleService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel a pending scheduled notification' })
  cancel(@Param('id') id: string): Promise<void> {
    return this.scheduleService.cancel(id);
  }
}
