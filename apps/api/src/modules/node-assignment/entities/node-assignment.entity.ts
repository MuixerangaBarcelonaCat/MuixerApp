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
import { FigureNode } from '../../figure/entities/figure-node.entity';
import { Person } from '../../person/person.entity';
import { CompositionSlot } from '../../composition/entities/composition-slot.entity';

@Entity('node_assignments')
@Unique(['figureInstance', 'figureNode', 'compositionSlot'])
@Unique(['figureInstance', 'person', 'compositionSlot'])
export class NodeAssignment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FigureInstance, (instance) => instance.assignments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn()
  figureInstance: FigureInstance;

  @ManyToOne(() => FigureNode, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  figureNode: FigureNode;

  @ManyToOne(() => Person, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn()
  person: Person;

  /**
   * Required when figureInstance references a CompositionTemplate.
   * Identifies which slot within the composition this assignment belongs to,
   * disambiguating when the same FigureTemplate appears in multiple slots.
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
