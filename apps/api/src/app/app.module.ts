import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { envValidationSchema } from '../config/env.validation';
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
import { CompositionModule } from '../modules/composition/composition.module';
import { PersonDelegateModule } from '../modules/person-delegate/person-delegate.module';
import { LegalModule } from '../modules/legal/legal.module';
import { AuditModule } from '../modules/audit/audit.module';
import { MeModule } from '../modules/me/me.module';
import { MailModule } from '../modules/mail/mail.module';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../modules/auth/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      validationOptions: { allowUnknown: true, abortEarly: false },
    }),
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
    CompositionModule,
    PersonDelegateModule,
    LegalModule,
    AuditModule,
    MeModule,
    MailModule,
  ],
  controllers: [AppController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
