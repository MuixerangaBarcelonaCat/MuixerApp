import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { Composition } from '../composition/entities/composition.entity';
import { EventSegmentController } from './event-segment.controller';
import { EventSegmentService } from './event-segment.service';
import { FigureInstanceService } from './figure-instance.service';
import { ProjectionService } from './projection.service';
import { NodeAssignmentModule } from '../node-assignment/node-assignment.module';
@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventSegment,
      FigureInstance,
      Event,
      Attendance,
      FigureTemplate,
      Composition,
    ]),
    NodeAssignmentModule,
  ],
  controllers: [EventSegmentController],
  providers: [EventSegmentService, FigureInstanceService, ProjectionService],
  exports: [EventSegmentService, FigureInstanceService, ProjectionService],
})
export class EventSegmentModule {}
