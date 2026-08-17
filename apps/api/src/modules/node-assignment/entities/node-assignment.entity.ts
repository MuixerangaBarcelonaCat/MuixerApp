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
   * Denormalized from figureInstance.segment. Since Fase 5 (docs/SEGMENTS_FLEXIBILITY.md)
   * a person may hold more than one placement in the same segment, so this column no
   * longer backs a unique constraint — it exists to keep the segment-conflict queries
   * (getSegmentConflicts, getSegmentMoveConflicts) cheap and to let move() re-point
   * assignments without a join through figureInstance.
   */
  @ManyToOne(() => EventSegment, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn()
  segment: EventSegment;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
