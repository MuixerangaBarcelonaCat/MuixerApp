import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Event } from './event.entity';
import { Attendance } from './attendance.entity';
import { Season } from '../season/season.entity';
import { Person } from '../person/person.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { SeasonModule } from '../season/season.module';
import { EventController } from './event.controller';
import { EventService } from './event.service';
import { AttendanceService } from './attendance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Event, Attendance, Season, Person, EventSegment]),
    SeasonModule,
  ],
  controllers: [EventController],
  providers: [EventService, AttendanceService],
  exports: [EventService, AttendanceService],
})
export class EventModule {}
