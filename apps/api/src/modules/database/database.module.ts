import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
// typeorm requires `pg` dynamically (driver lookup by the `type: 'postgres'` string above),
// so Nx's static dependency scan won't see it and won't pin it in the generated production
// package.json unless it's imported directly somewhere in the bundle.
import 'pg';
import { Tag } from '../tag/tag.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Season } from '../season/season.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { Composition } from '../composition/entities/composition.entity';
import { CompositionEntry } from '../composition/entities/composition-entry.entity';
import { EventSegment } from '../event-segment/entities/event-segment.entity';
import { FigureInstance } from '../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../event-segment/entities/instance-node.entity';
import { NodeAssignment } from '../node-assignment/entities/node-assignment.entity';
import { Rengla } from '../figure/entities/rengla.entity';
import { migrations } from '../../migrations';

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
            Tag,
            User,
            Person,
            Season,
            Event,
            Attendance,
            RefreshToken,
            FigureTemplate,
            FigureNode,
            Rengla,
            Composition,
            CompositionEntry,
            EventSegment,
            FigureInstance,
            InstanceNode,
            NodeAssignment,
          ],
          synchronize: false,
          migrationsRun: isDevelopment,
          migrations,
          migrationsTableName: 'typeorm_migrations',
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
