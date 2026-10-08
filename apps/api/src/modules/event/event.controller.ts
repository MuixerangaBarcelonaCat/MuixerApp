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
import { ApiTags, ApiOperation, ApiParam, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtPayload, UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';
import { EventFilterDto } from './dto/event-filter.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { AttendanceFilterDto } from './dto/attendance-filter.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';

@ApiTags('events')
@ApiBearerAuth()
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

  @Put(':id/attendance/:personId')
  @ApiOperation({
    summary: 'Establir l\'assistència d\'una persona a un esdeveniment',
    description:
      'L\'assistència és un estat de (persona, esdeveniment): no tindre registre equival a PENDENT. ' +
      'PENDENT sense notes per a algú sense registre no escriu res.',
  })
  @ApiParam({ name: 'id', description: 'UUID de l\'esdeveniment' })
  @ApiParam({ name: 'personId', description: 'UUID de la persona' })
  @ApiResponse({ status: 200, description: 'Assistència establida, retorna l\'assistència i el summary actualitzat' })
  @ApiResponse({ status: 404, description: 'Esdeveniment o persona no trobats' })
  @ApiResponse({ status: 403, description: 'Event bloquejat (cal force per sobreescriure)' })
  setAttendance(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) eventId: string,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.attendanceService.set(eventId, personId, dto, user.sub);
  }
}
