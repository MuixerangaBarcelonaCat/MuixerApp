import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/person.entity';
import { Position } from '../position/position.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { Season } from '../season/season.entity';
import { SyncController } from './sync.controller';
import { LegacyApiClient } from './legacy-api.client';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { EventSyncStrategy } from './strategies/event-sync.strategy';
import { AttendanceSyncStrategy } from './strategies/attendance-sync.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Position, Event, Attendance, Season, User])],
  controllers: [SyncController],
  providers: [
    LegacyApiClient,
    PersonSyncStrategy,
    EventSyncStrategy,
    AttendanceSyncStrategy,
  ],
})
export class SyncModule {}
