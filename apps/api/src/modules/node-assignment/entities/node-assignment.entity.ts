import {
  Entity,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';
import { FigureInstance } from '../../event-segment/entities/figure-instance.entity';
import { InstanceNode } from '../../event-segment/entities/instance-node.entity';
import { EventSegment } from '../../event-segment/entities/event-segment.entity';
import { Person } from '../../person/person.entity';

@Entity('node_assignments')
@Unique(['figureInstance', 'instanceNode'])
@Unique(['figureInstance', 'person'])
@Unique(['segment', 'person'])
export class NodeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureInstance, (instance) => instance.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  figureInstance: FigureInstance;

  @ManyToOne(() => InstanceNode, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  instanceNode: InstanceNode;

  @ManyToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  person: Person;

  /**
   * Denormalized from figureInstance.segment — a person may only be assigned once
   * per segment (across all its figure instances), and Postgres unique constraints
   * can't span a join, so this column exists to let the DB enforce that invariant
   * instead of relying solely on the application-level check in assign() (BUG-18).
   */
  @ManyToOne(() => EventSegment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  segment: EventSegment;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
