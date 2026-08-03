import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { LegalDocument, LegalDocumentType } from '@muixer/shared';
import { environment } from '../../../environments/environment';

@Injectable({ providedIn: 'root' })
export class LegalDocumentService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/legal`;

  /** The active document of a given type. */
  getActive(type: LegalDocumentType): Observable<LegalDocument> {
    return this.http.get<LegalDocument>(`${this.baseUrl}/${type}/active`);
  }
}
