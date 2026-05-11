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

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EventSegment,
      FigureInstance,
      Event,
      FigureTemplate,
      CompositionTemplate,
    ]),
  ],
  controllers: [EventSegmentController],
  providers: [EventSegmentService, FigureInstanceService],
  exports: [EventSegmentService, FigureInstanceService],
})
export class EventSegmentModule {}
