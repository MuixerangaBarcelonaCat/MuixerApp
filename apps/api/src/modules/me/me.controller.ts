import {
  Controller,
  Get,
  Sse,
  MessageEvent,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';
import {
  JwtPayload,
  PaginatedResponse,
  MeEvent,
  MeEventDetail,
  MeSegment,
  AttendanceResponse,
  PendingDependent,
  ManagedPerson,
  PersonProfileSummary,
  UserRole,
  MeNewsItem,
  EventAttendanceStats,
} from '@muixer/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProjectionData } from '../event-segment/projection.service';
import { PersonDelegateResponseDto } from '../person-delegate/dto/person-delegate-response.dto';
import { Observable } from 'rxjs';
import { SseAuth } from '../auth/decorators/sse-auth.decorator';
import { SegmentEventsService } from '../segment-events/segment-events.service';
import { MeService } from './me.service';
import { MeEventFilterDto } from './dto/me-event-filter.dto';
import { UpdateMyAttendanceDto } from './dto/update-my-attendance.dto';
import { DependentRegistrationDto } from './dto/dependent-registration.dto';
import { ListManagedPersonsDto } from './dto/list-managed-persons.dto';
import { CreateMemberDelegateDto } from './dto/create-member-delegate.dto';

@ApiTags('me')
@ApiBearerAuth()
@Controller('me')
@Roles(UserRole.MEMBER, UserRole.TECHNICAL, UserRole.ADMIN)
export class MeController {
  constructor(
    private readonly meService: MeService,
    private readonly segmentEvents: SegmentEventsService,
  ) {}

  @Get('events')
  @ApiOperation({ summary: 'List events for authenticated member' })
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

  @Get('events/:id/attendance-stats')
  @Roles(UserRole.TECHNICAL, UserRole.ADMIN)
  @ApiOperation({ summary: "Desglossament d'assistència per estat, adults vs xicalla" })
  getEventAttendanceStats(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<EventAttendanceStats> {
    return this.meService.getEventAttendanceStats(id);
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

  /**
   * Live figure-data changes for one event, so an open projection refetches instead of
   * waiting for a manual reload. Narrowed per message to published segments only — the
   * same scope the projection endpoint enforces.
   */
  @Sse('events/:eventId/changes')
  @SseAuth()
  @ApiOperation({ summary: 'Stream live figure-data changes for an event (published segments only)' })
  streamEventChanges(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Observable<MessageEvent> {
    return this.segmentEvents.stream(eventId, (change) =>
      this.meService.narrowSegmentChangeForMember(change),
    );
  }

  @Get('persons')
  @ApiOperation({ summary: 'Jo + persones que gestiono (opcionalment restringit a delegat principal)' })
  listManagedPersons(
    @CurrentUser() user: JwtPayload,
    @Query() filters: ListManagedPersonsDto,
  ): Promise<ManagedPerson[]> {
    return this.meService.resolveManagedPersons(user.sub, { primaryOnly: filters.primaryOnly });
  }

  @Get('persons/:personId')
  @ApiOperation({ summary: "Resum d'una persona gestionada (àlies, nom, nombre de delegacions)" })
  getPersonSummary(
    @CurrentUser() user: JwtPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<PersonProfileSummary> {
    return this.meService.getPersonSummary(user.sub, personId);
  }

  @Get('persons/:personId/delegates')
  @ApiOperation({ summary: "Llistar els delegats d'una persona gestionada" })
  async listPersonDelegates(
    @CurrentUser() user: JwtPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
  ): Promise<PersonDelegateResponseDto[]> {
    const delegates = await this.meService.listPersonDelegates(user.sub, personId);
    return plainToInstance(PersonDelegateResponseDto, delegates, { excludeExtraneousValues: true });
  }

  @Post('persons/:personId/delegates')
  @ApiOperation({ summary: "Afegir un delegat (per àlies) a una persona gestionada" })
  async createPersonDelegate(
    @CurrentUser() user: JwtPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Body() dto: CreateMemberDelegateDto,
  ): Promise<PersonDelegateResponseDto> {
    const delegate = await this.meService.createPersonDelegate(user.sub, personId, dto);
    return plainToInstance(PersonDelegateResponseDto, delegate, { excludeExtraneousValues: true });
  }

  @Delete('persons/:personId/delegates/:delegateId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Eliminar un delegat d'una persona gestionada" })
  removePersonDelegate(
    @CurrentUser() user: JwtPayload,
    @Param('personId', ParseUUIDPipe) personId: string,
    @Param('delegateId', ParseUUIDPipe) delegateId: string,
  ): Promise<void> {
    return this.meService.removePersonDelegate(user.sub, personId, delegateId);
  }

  @Get('news')
  @ApiOperation({ summary: 'List published news items' })
  findNews(): Promise<MeNewsItem[]> {
    return this.meService.findNews();
  }

  @Get('news/:id')
  @ApiOperation({ summary: 'Get published news item detail' })
  findNewsDetail(@Param('id', ParseUUIDPipe) id: string): Promise<MeNewsItem> {
    return this.meService.findNewsDetail(id);
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
