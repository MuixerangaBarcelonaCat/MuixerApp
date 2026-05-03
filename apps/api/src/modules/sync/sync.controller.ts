import { Controller, Get, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable, concat, map } from 'rxjs';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { EventSyncStrategy } from './strategies/event-sync.strategy';
import { AttendanceSyncStrategy } from './strategies/attendance-sync.strategy';
import { SyncEvent } from './interfaces/sync-event.interface';

interface MessageEvent {
  data: string;
}

@ApiTags('sync')
@ApiBearerAuth()
@Controller('sync')
@Roles(UserRole.ADMIN)
export class SyncController {
  constructor(
    private readonly personSyncStrategy: PersonSyncStrategy,
    private readonly eventSyncStrategy: EventSyncStrategy,
    private readonly attendanceSyncStrategy: AttendanceSyncStrategy,
  ) {}

  /** Inicia la sincronització de membres (persones) des del legacy APPsistència. Emet events SSE de progrés mentre s'executa. */
  @Get('persons')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar membres des del legacy API (SSE stream)' })
  syncPersons(): Observable<MessageEvent> {
    return this.personSyncStrategy.execute().pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }

  /** Inicia la sincronització d'esdeveniments (assajos + actuacions) i la seva assistència. Inclou la creació de temporades i el parsing dels XLSX. */
  @Get('events')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar esdeveniments i assistència des del legacy API (SSE stream)' })
  syncEvents(): Observable<MessageEvent> {
    return this.eventSyncStrategy.execute().pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }

  /** Sincronitza l'assistència d'un sol event per UUID (bypass de la sync global d'events). Útil per actualitzar dades puntuals. */
  @Get('events/:eventId/attendance')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar assistència d\'un sol esdeveniment des del legacy API (SSE stream)' })
  syncSingleEventAttendance(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ): Observable<MessageEvent> {
    return this.attendanceSyncStrategy.executeSingleEvent(eventId).pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }

  /** Executa la sincronització completa en seqüència: primer persones, després esdeveniments i assistència. */
  @Get('all')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar tot (membres + esdeveniments + assistència) des del legacy API (SSE stream)' })
  syncAll(): Observable<MessageEvent> {
    return concat(
      this.personSyncStrategy.execute(),
      this.eventSyncStrategy.execute(),
    ).pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }
}
