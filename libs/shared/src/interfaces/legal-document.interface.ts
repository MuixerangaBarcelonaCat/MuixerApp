import { LegalDocumentType } from '../enums/legal-document-type.enum';

/** Versioned legal text (privacy policy, transparency clause), as returned by the API. */
export interface LegalDocument {
  id: string;
  type: LegalDocumentType;
  version: number;
  content: string;
  isActive: boolean;
  /** Whether this version obliges users to re-accept (the "consent watermark" candidate). */
  requiresConsent: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
