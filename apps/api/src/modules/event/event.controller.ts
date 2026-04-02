import { Controller, Get, Patch, Param, Body, Query, ParseUUIDPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { EventFilterDto } from './dto/event-filter.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';

@ApiTags('events')
@Controller('events')
export class EventController {
  constructor(
    private readonly eventService: EventService,
    private readonly attendanceService: AttendanceService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Llistar esdeveniments amb filtres i paginació' })
  @ApiResponse({ status: 200, description: 'Llista d\'esdeveniments' })
  async findAll(@Query() filters: EventFilterDto) {
    const { data, total } = await this.eventService.findAll(filters);
    return {
      data,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 25,
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un esdeveniment per ID' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 200, description: 'Esdeveniment trobat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualitzar un esdeveniment (countsForStatistics, seasonId)' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 200, description: 'Esdeveniment actualitzat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(id, dto);
  }

  @Get(':id/attendance')
  @ApiOperation({ summary: 'Llistar assistència d\'un esdeveniment' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 200, description: 'Llista d\'assistència' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  async findAttendance(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() filters: AttendanceFilterDto,
  ) {
    const { data, total } = await this.attendanceService.findByEvent(id, filters);
    return {
      data,
      meta: {
        total,
        page: filters.page ?? 1,
        limit: filters.limit ?? 100,
      },
    };
  }
}
