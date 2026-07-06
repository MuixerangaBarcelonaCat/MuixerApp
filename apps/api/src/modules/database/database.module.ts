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
import { InitialSchema1748600000000 } from '../../migrations/1748600000000-InitialSchema';
import { AddUpdatedAtToRengles1749106300000 } from '../../migrations/1749106300000-AddUpdatedAtToRengles';
import { AddUpdatedAtToMissingTables1749106400000 } from '../../migrations/1749106400000-AddUpdatedAtToMissingTables';
import { AddPersonInstanceUniqueConstraint1749106500000 } from '../../migrations/1749106500000-AddPersonInstanceUniqueConstraint';
import { RemoveFigureFamily1780982679300 } from '../../migrations/1780982679300-RemoveFigureFamily';
import { RestoreProjectionColumnsAndReferenceElements1781000000000 } from '../../migrations/1781000000000-RestoreProjectionColumnsAndReferenceElements';
import { DropSourceVariantOrder1781100000000 } from '../../migrations/1781100000000-DropSourceVariantOrder';
import { AddAdHocInstanceNodes1781200000000 } from '../../migrations/1781200000000-AddAdHocInstanceNodes';
import { SimplifyRengles1781300000000 } from '../../migrations/1781300000000-SimplifyRengles';
import { EnableFuzzySearch1781400000000 } from '../../migrations/1781400000000-EnableFuzzySearch';
import { DropCordonsColumns1781500000000 } from '../../migrations/1781500000000-DropCordonsColumns';
import { AddNumberOfCordons1781600000000 } from '../../migrations/1781600000000-AddNumberOfCordons';
import { DropHasPinya1781700000000 } from '../../migrations/1781700000000-DropHasPinya';
import { AddFigureMode1781800000000 } from '../../migrations/1781800000000-AddFigureMode';
import { AddNetaFigureMode1781900000000 } from '../../migrations/1781900000000-AddNetaFigureMode';
import { TagPositionTypes1782000000000 } from '../../migrations/1782000000000-TagPositionTypes';
import { RemoveNoPresentat1782100000000 } from '../../migrations/1782100000000-RemoveNoPresentat';
import { AddSegmentDistributionFields1782200000000 } from '../../migrations/1782200000000-AddSegmentDistributionFields';
import { DropOldCompositionTables1782300000000 } from '../../migrations/1782300000000-DropOldCompositionTables';
import { CreateCompositions1782400000000 } from '../../migrations/1782400000000-CreateCompositions';

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
          migrations: [
            InitialSchema1748600000000,
            AddUpdatedAtToRengles1749106300000,
            AddUpdatedAtToMissingTables1749106400000,
            AddPersonInstanceUniqueConstraint1749106500000,
            RemoveFigureFamily1780982679300,
            RestoreProjectionColumnsAndReferenceElements1781000000000,
            DropSourceVariantOrder1781100000000,
            AddAdHocInstanceNodes1781200000000,
            SimplifyRengles1781300000000,
            EnableFuzzySearch1781400000000,
            DropCordonsColumns1781500000000,
            AddNumberOfCordons1781600000000,
            DropHasPinya1781700000000,
            AddFigureMode1781800000000,
            AddNetaFigureMode1781900000000,
            TagPositionTypes1782000000000,
            RemoveNoPresentat1782100000000,
            AddSegmentDistributionFields1782200000000,
            DropOldCompositionTables1782300000000,
            CreateCompositions1782400000000,
          ],
          migrationsTableName: 'typeorm_migrations',
          logging: isDevelopment,
        };
      },
    }),
  ],
})
export class DatabaseModule {}
