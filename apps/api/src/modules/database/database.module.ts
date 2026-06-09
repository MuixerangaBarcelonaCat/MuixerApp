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
import { FigureFamilyNode } from '../figure/entities/figure-family-node.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { Rengla } from '../figure/entities/rengla.entity';
import { InitialSchema1748600000000 } from '../../migrations/1748600000000-InitialSchema';

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
            FigureFamilyNode,
            CompositionTemplate,
            CompositionSlot,
            EventSegment,
            FigureInstance,
            InstanceNode,
            NodeAssignment,
            Rengla,
          ],
          synchronize: false,
          migrationsRun: isDevelopment,
          migrations: [InitialSchema1748600000000],
          migrationsTableName: 'typeorm_migrations',
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
