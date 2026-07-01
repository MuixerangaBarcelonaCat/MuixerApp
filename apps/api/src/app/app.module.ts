import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { DatabaseModule } from '../modules/database/database.module';
import { TagModule } from '../modules/tag/tag.module';
import { UserModule } from '../modules/user/user.module';
import { PersonModule } from '../modules/person/person.module';
import { SyncModule } from '../modules/sync/sync.module';
import { SeasonModule } from '../modules/season/season.module';
import { EventModule } from '../modules/event/event.module';
import { AuthModule } from '../modules/auth/auth.module';
import { FigureModule } from '../modules/figure/figure.module';
import { EventSegmentModule } from '../modules/event-segment/event-segment.module';
import { NodeAssignmentModule } from '../modules/node-assignment/node-assignment.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    DatabaseModule,
    TagModule,
    UserModule,
    PersonModule,
    SyncModule,
    SeasonModule,
    EventModule,
    AuthModule,
    FigureModule,
    EventSegmentModule,
    NodeAssignmentModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
