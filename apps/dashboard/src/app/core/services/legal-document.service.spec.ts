import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { LegalDocumentType } from '@muixer/shared';
import { LegalDocumentService } from './legal-document.service';

describe('LegalDocumentService', () => {
  let service: LegalDocumentService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [LegalDocumentService],
    });
    service = TestBed.inject(LegalDocumentService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('getActive requests the active document of a type', () => {
    service.getActive(LegalDocumentType.PRIVACY_POLICY).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/legal/PRIVACY_POLICY/active'));
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getAll requests the documents list', () => {
    service.getAll().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/legal/documents'));
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('publish POSTs the type and content', () => {
    service
      .publish({ type: LegalDocumentType.TRANSPARENCY_CLAUSE, content: 'text' })
      .subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/legal/documents'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      type: LegalDocumentType.TRANSPARENCY_CLAUSE,
      content: 'text',
    });
    req.flush({});
  });
});
