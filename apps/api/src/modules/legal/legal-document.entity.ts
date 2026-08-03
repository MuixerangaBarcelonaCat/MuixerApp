import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LegalDocumentType } from '@muixer/shared';

/**
 * Versioned legal texts (privacy policy, transparency clause) editable from the dashboard.
 * Exactly one row per `type` may have `isActive = true` (enforced by a partial unique index).
 * The active `PRIVACY_POLICY` version drives the click-wrap re-consent gate.
 */
@Entity('legal_documents')
export class LegalDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: LegalDocumentType })
  type: LegalDocumentType;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'boolean', default: false })
  isActive: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
