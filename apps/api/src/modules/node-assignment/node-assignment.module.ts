import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NodeAssignment } from './entities/node-assignment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Person } from '../person/person.entity';
import { Attendance } from '../event/attendance.entity';
import { Event } from '../event/event.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { NodeAssignmentController } from './node-assignment.controller';
import { NodeAssignmentService } from './node-assignment.service';
import { AvailablePersonsService } from './available-persons.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NodeAssignment,
      FigureInstance,
      InstanceNode,
      FigureNode,
      Person,
      Attendance,
      Event,
      CompositionSlot,
      EventSegment,
      FigureTemplate,
    ]),
  ],
  controllers: [NodeAssignmentController],
  providers: [NodeAssignmentService, AvailablePersonsService],
  exports: [NodeAssignmentService],
})
export class NodeAssignmentModule {}
