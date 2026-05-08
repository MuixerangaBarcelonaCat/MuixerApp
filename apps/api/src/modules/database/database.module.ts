import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Position } from '../position/position.entity';
import { User } from '../user/user.entity';
import { Person } from '../person/person.entity';
import { Season } from '../season/season.entity';
import { Event } from '../event/event.entity';
import { Attendance } from '../event/attendance.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { FigureTemplate } from '../figure/entities/figure-template.entity';
import { FigureNode } from '../figure/entities/figure-node.entity';
import { CompositionTemplate } from '../composition/entities/composition-template.entity';
import { CompositionSlot } from '../composition/entities/composition-slot.entity';

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
          entities: [Position, User, Person, Season, Event, Attendance, RefreshToken, FigureTemplate, FigureNode, CompositionTemplate, CompositionSlot],
          synchronize: isDevelopment,
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
