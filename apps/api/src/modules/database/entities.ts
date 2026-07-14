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

/** Single source of truth for the entity list, shared by the Nest TypeOrmModule and the integration-test DataSource. */
export const ENTITIES = [
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
];
