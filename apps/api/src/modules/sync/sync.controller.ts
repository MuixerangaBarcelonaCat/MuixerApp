import { Controller, Get, Param, ParseUUIDPipe, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, concat, map } from 'rxjs';
import { UserRole } from '@muixer/shared';
import { Roles } from '../auth/decorators/roles.decorator';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { EventSyncStrategy } from './strategies/event-sync.strategy';
import { AttendanceSyncStrategy } from './strategies/attendance-sync.strategy';
import { LegacyApiClient } from './legacy-api.client';
import { SyncEvent } from './interfaces/sync-event.interface';

interface MessageEvent {
  data: string;
}

@ApiTags('sync')
@Controller('sync')
@Roles(UserRole.TECHNICAL, UserRole.ADMIN)
export class SyncController {
  constructor(
    private readonly personSyncStrategy: PersonSyncStrategy,
    private readonly eventSyncStrategy: EventSyncStrategy,
    private readonly attendanceSyncStrategy: AttendanceSyncStrategy,
    private readonly legacyApiClient: LegacyApiClient,
  ) {}

  @Get('persons')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar membres des del legacy API (SSE stream)' })
  syncPersons(): Observable<MessageEvent> {
    return this.personSyncStrategy.execute().pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }

  @Get('events')
  @Sse()
  @ApiOperation({ summary: 'Sincronitzar esdeveniments i assistència des del legacy API (SSE stream)' })
  syncEvents(): Observable<MessageEvent> {
    return this.eventSyncStrategy.execute().pipe(
      map((event: SyncEvent) => ({ data: JSON.stringify(event) })),
    );
  }

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
