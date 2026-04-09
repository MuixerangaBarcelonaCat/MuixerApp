import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from '../modules/database/database.module';
import { PositionModule } from '../modules/position/position.module';
import { UserModule } from '../modules/user/user.module';
import { PersonModule } from '../modules/person/person.module';
import { SyncModule } from '../modules/sync/sync.module';
import { SeasonModule } from '../modules/season/season.module';
import { EventModule } from '../modules/event/event.module';
import { AuthModule } from '../modules/auth/auth.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60000, limit: 100 }] }),
    DatabaseModule,
    PositionModule,
    UserModule,
    PersonModule,
    SyncModule,
    SeasonModule,
    EventModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Aquest guard limita el nombre de peticions que pot fer cada client en un temps determinat (rate limiting).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
