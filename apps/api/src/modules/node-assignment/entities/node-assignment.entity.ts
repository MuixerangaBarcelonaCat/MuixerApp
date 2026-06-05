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
import { Person } from '../../person/person.entity';
import { CompositionSlot } from '../../composition/entities/composition-slot.entity';

@Entity('node_assignments')
@Unique(['figureInstance', 'instanceNode', 'compositionSlot'])
@Unique(['figureInstance', 'person', 'compositionSlot'])
@Unique(['figureInstance', 'person'])
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
   * Required when figureInstance references a CompositionTemplate.
   * Null for standalone (non-composition) figure instances.
   */
  @ManyToOne(() => CompositionSlot, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn()
  compositionSlot: CompositionSlot | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
