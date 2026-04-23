import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiParam, ApiResponse } from '@nestjs/swagger';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { EventFilterDto } from './dto/event-filter.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@ApiTags('events')
@Controller('events')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
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

  @Post()
  @ApiOperation({ summary: 'Crear un nou esdeveniment' })
  @ApiResponse({ status: 201, description: 'Esdeveniment creat' })
  @ApiResponse({ status: 400, description: 'Dades invàlides' })
  @ApiResponse({ status: 404, description: 'Temporada no trobada' })
  create(@Body() dto: CreateEventDto) {
    return this.eventService.create(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtenir un esdeveniment per ID' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 200, description: 'Esdeveniment trobat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualitzar un esdeveniment (tots els camps)' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 200, description: 'Esdeveniment actualitzat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.eventService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un esdeveniment (bloquejat si té assistència)' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 204, description: 'Esdeveniment eliminat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment no trobat' })
  @ApiResponse({ status: 409, description: 'Té registres d\'assistència' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.eventService.remove(id);
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

  @Post(':id/attendance')
  @ApiOperation({ summary: 'Crear un registre d\'assistència' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiResponse({ status: 201, description: 'Assistència creada' })
  @ApiResponse({ status: 404, description: 'Esdeveniment o persona no trobats' })
  @ApiResponse({ status: 409, description: 'Ja existeix un registre per aquesta persona' })
  createAttendance(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateAttendanceDto,
  ) {
    return this.attendanceService.create(eventId, dto);
  }

  @Put(':id/attendance/:attendanceId')
  @ApiOperation({ summary: 'Actualitzar un registre d\'assistència' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiParam({ name: 'attendanceId', description: 'UUID del registre d\'assistència' })
  @ApiResponse({ status: 200, description: 'Assistència actualitzada' })
  @ApiResponse({ status: 404, description: 'Registre no trobat' })
  updateAttendance(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.update(eventId, attendanceId, dto);
  }

  @Delete(':id/attendance/:attendanceId')
  @ApiOperation({ summary: 'Eliminar un registre d\'assistència' })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiParam({ name: 'attendanceId', description: 'UUID del registre d\'assistència' })
  @ApiResponse({ status: 200, description: 'Assistència eliminada, retorna summary actualitzat' })
  @ApiResponse({ status: 404, description: 'Registre no trobat' })
  removeAttendance(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('attendanceId', ParseUUIDPipe) attendanceId: string,
  ) {
    return this.attendanceService.remove(eventId, attendanceId);
  }
}
