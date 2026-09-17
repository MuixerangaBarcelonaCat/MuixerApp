import { HttpRequest } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { ClientIdService } from './client-id.service';
import { clientIdInterceptor } from './client-id.interceptor';

describe('clientIdInterceptor', () => {
  function run(url = '/api/persons') {
    TestBed.configureTestingModule({
      providers: [{ provide: ClientIdService, useValue: { id: 'tab-1' } }],
    });

    const req = new HttpRequest('GET', url);
    const next = vi.fn().mockReturnValue(of(undefined));
    TestBed.runInInjectionContext(() => clientIdInterceptor(req, next));
    return next.mock.calls[0][0] as HttpRequest<unknown>;
  }

  it('sets X-Client-Id on the request to this tab\'s id', () => {
    const sentReq = run();
    expect(sentReq.headers.get('X-Client-Id')).toBe('tab-1');
  });

  it('sets it on every request, including GETs — the header is inert there but the tab id has to be constant', () => {
    const sentReq = run('/api/events/e1/segments');
    expect(sentReq.headers.get('X-Client-Id')).toBe('tab-1');
  });
});
