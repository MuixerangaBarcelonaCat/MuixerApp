import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Person } from '../person/person.entity';
import { Position } from '../position/position.entity';
import { SyncController } from './sync.controller';
import { LegacyApiClient } from './legacy-api.client';
import { PersonSyncStrategy } from './strategies/person-sync.strategy';

@Module({
  imports: [TypeOrmModule.forFeature([Person, Position])],
  controllers: [SyncController],
  providers: [LegacyApiClient, PersonSyncStrategy],
})
export class SyncModule {}
