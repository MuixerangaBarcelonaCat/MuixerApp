import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { LegalDocumentType } from '@muixer/shared';
import { LegalDocumentService } from './legal-document.service';

describe('LegalDocumentService', () => {
  let service: LegalDocumentService;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LegalDocumentService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('getActive requests the active document of a type', () => {
    service.getActive(LegalDocumentType.PRIVACY_POLICY).subscribe();
    const req = httpTesting.expectOne((r) => r.url.endsWith('/legal/PRIVACY_POLICY/active'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });
});
