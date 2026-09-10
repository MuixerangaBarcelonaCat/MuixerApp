import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../../environments/environment';
import { PersonDelegateService } from './person-delegate.service';

describe('PersonDelegateService', () => {
  let service: PersonDelegateService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PersonDelegateService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(PersonDelegateService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('searches narrow candidates through the person-scoped endpoint', () => {
    service.getCandidates('person-1', 'joana').subscribe();

    const request = http.expectOne(
      (candidate) =>
        candidate.url ===
          `${environment.apiUrl}/persons/person-1/delegates/candidates` &&
        candidate.params.get('search') === 'joana',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });
});
