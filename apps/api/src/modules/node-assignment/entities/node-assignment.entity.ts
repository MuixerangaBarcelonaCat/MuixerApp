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

@Entity('node_assignments')
@Unique(['figureInstance', 'instanceNode'])
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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
