import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from '../position/position.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Season } from '../season/season.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { FigureFamily } from '../figure/entities/figure-family.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isDevelopment = process.env.NODE_ENV !== 'production';
        const sslEnabled = process.env.DB_SSL === 'true';

        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          ssl: sslEnabled ? { rejectUnauthorized: false } : false,
          entities: [
            Position,
            User,
            Person,
            Season,
            Event,
            Attendance,
            RefreshToken,
            FigureFamily,
            FigureTemplate,
            FigureNode,
            CompositionTemplate,
            CompositionSlot,
            EventSegment,
            FigureInstance,
            InstanceNode,
            NodeAssignment,
          ],
          synchronize: isDevelopment,
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
