import { Controller, Get, Sse } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Observable, map } from 'rxjs';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { LegacyApiClient } from './legacy-api.client';
import { SyncEvent } from './interfaces/sync-event.interface';

interface MessageEvent {
  data: string;
}

@ApiTags('sync')
@Controller('sync')
export class SyncController {
  constructor(
    private readonly personSyncStrategy: PersonSyncStrategy,
    private readonly legacyApiClient: LegacyApiClient,
  ) {}

  // @Get('test-login')
  // @ApiOperation({ summary: 'Test legacy API login (debug endpoint)' })
  // async testLogin(): Promise<{ success: boolean; message: string }> {
  //   try {
  //     await this.legacyApiClient.login();
  //     return { success: true, message: 'Login successful' };
  //   } catch (error) {
  //     const err = error as Error;
  //     return { success: false, message: err.message };
  //   }
  // }

  @Get('persons')
  @Sse()
  @ApiOperation({ summary: 'Sync persons from legacy API (SSE stream)' })
  syncPersons(): Observable<MessageEvent> {
    return this.personSyncStrategy.execute().pipe(
      map((event: SyncEvent) => ({
        data: JSON.stringify(event),
      })),
    );
  }
}
