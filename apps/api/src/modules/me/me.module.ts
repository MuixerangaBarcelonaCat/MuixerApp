import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { User } from '../user/user.entity';
import { SeasonModule } from '../season/season.module';
import { EventModule } from '../event/event.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Attendance, User]),
    SeasonModule,
    EventModule,
  ],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
