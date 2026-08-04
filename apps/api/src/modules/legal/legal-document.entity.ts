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
 *
 * `isActive` and `requiresConsent` are deliberately independent: `isActive` marks which version's
 * text is currently shown; `requiresConsent` marks whether *that particular version* obliges users
 * to re-accept. This lets an admin publish a typo fix (`requiresConsent: false` — text updates, no
 * one re-signs) separately from a substantive change (`true` — everyone must re-accept). The
 * click-wrap gate compares against the highest `PRIVACY_POLICY` version with `requiresConsent = true`
 * (the "consent watermark"), not against the active version — see `LegalDocumentService.getConsentVersion`.
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

  /** Whether this version obliges users to re-accept (the "consent watermark" candidate). */
  @Column({ type: 'boolean', default: false })
  requiresConsent: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;
}
