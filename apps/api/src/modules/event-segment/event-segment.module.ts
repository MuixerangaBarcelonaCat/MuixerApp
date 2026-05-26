import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventSegment } from './entities/event-segment.entity';
import { FigureInstance } from './entities/figure-instance.entity';
import { Event } from '../event/event.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { EventSegmentController } from './event-segment.controller';
import { EventSegmentService } from './event-segment.service';
import { FigureInstanceService } from './figure-instance.service';
import { ProjectionService } from './projection.service';
import { NodeAssignmentModule } from '../node-assignment/node-assignment.module';
import { ReferenceElementModule } from '../reference-element/reference-element.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventSegment,
      FigureInstance,
      Event,
      FigureTemplate,
      CompositionTemplate,
    ]),
    NodeAssignmentModule,
    ReferenceElementModule,
  ],
  controllers: [EventSegmentController],
  providers: [EventSegmentService, FigureInstanceService, ProjectionService],
  exports: [EventSegmentService, FigureInstanceService, ProjectionService],
})
export class EventSegmentModule {}
