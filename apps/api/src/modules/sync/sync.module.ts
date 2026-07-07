import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/person.entity';
import { Tag } from '../tag/tag.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { Season } from '../season/season.entity';
import { SyncController } from './sync.controller';
import { LegacyApiClient } from './legacy-api.client';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';
import { EventSyncStrategy } from './strategies/event-sync.strategy';
import { AttendanceSyncStrategy } from './strategies/attendance-sync.strategy';
import { SyncLockService } from './sync-lock.service';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Tag, Event, Attendance, Season, User])],
  controllers: [SyncController],
  providers: [
    LegacyApiClient,
    PersonSyncStrategy,
    EventSyncStrategy,
    AttendanceSyncStrategy,
    SyncLockService,
  ],
})
export class SyncModule {}
