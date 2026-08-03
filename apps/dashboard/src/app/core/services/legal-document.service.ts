import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import { ApiService } from './api.service';

export interface PublishLegalDocumentDto {
  type: LegalDocumentType;
  content: string;
}

@Injectable({ providedIn: 'root' })
export class LegalDocumentService extends ApiService {
  /** All documents with all their versions (admin editor). */
  getAll(): Observable<LegalDocument[]> {
    return this.get<LegalDocument[]>('/legal/documents');
  }

  /** The active document of a given type. */
  getActive(type: LegalDocumentType): Observable<LegalDocument> {
    return this.get<LegalDocument>(`/legal/${type}/active`);
  }

  /** Publish a new active version of a document type. */
  publish(dto: PublishLegalDocumentDto): Observable<LegalDocument> {
    return this.post<LegalDocument>('/legal/documents', dto);
  }
}
