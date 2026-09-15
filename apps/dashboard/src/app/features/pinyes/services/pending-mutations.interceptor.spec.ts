import { HttpRequest, HttpResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import { PendingMutationsService } from './pending-mutations.service';
import { pendingMutationsInterceptor } from './pending-mutations.interceptor';

describe('pendingMutationsInterceptor', () => {
  let tracker: PendingMutationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PendingMutationsService] });
    tracker = TestBed.inject(PendingMutationsService);
  });

  function run(req: HttpRequest<unknown>, next: (r: HttpRequest<unknown>) => unknown) {
    return TestBed.runInInjectionContext(() => pendingMutationsInterceptor(req, next as never));
  }

  it('counts a mutation to a figure-instances endpoint while it is in flight', () => {
    const req = new HttpRequest('PATCH', 'http://api/figure-instances/i1/cordons', {});
    let seenDuringRequest = -1;
    const result = run(req, () => {
      seenDuringRequest = tracker.count();
      return of(new HttpResponse({ status: 200 }));
    });

    (result as ReturnType<typeof of>).subscribe();

    expect(seenDuringRequest).toBe(1);
    expect(tracker.count()).toBe(0);
  });

  it('counts a mutation to an events/segments endpoint', () => {
    const req = new HttpRequest('PUT', 'http://api/events/e1/segments/s1', {});
    let seenDuringRequest = -1;
    const result = run(req, () => {
      seenDuringRequest = tracker.count();
      return of(new HttpResponse({ status: 200 }));
    });

    (result as ReturnType<typeof of>).subscribe();

    expect(seenDuringRequest).toBe(1);
    expect(tracker.count()).toBe(0);
  });

  it('decrements even when the request fails — a rejected mutation must not leave the count stuck', () => {
    const req = new HttpRequest('POST', 'http://api/figure-instances/i1/assignments', {});
    const result = run(req, () => throwError(() => new Error('fail')));

    (result as ReturnType<typeof of>).subscribe({ error: () => undefined });

    expect(tracker.count()).toBe(0);
  });

  it('ignores GET requests — a read is never a mutation to gate on', () => {
    const req = new HttpRequest('GET', 'http://api/figure-instances/i1/nodes');
    let seenDuringRequest = -1;
    const result = run(req, () => {
      seenDuringRequest = tracker.count();
      return of(new HttpResponse({ status: 200 }));
    });

    (result as ReturnType<typeof of>).subscribe();

    expect(seenDuringRequest).toBe(0);
  });

  it('ignores a mutation to an unrelated endpoint, so an unrelated save does not block the segment banner', () => {
    const req = new HttpRequest('PUT', 'http://api/persons/p1', {});
    let seenDuringRequest = -1;
    const result = run(req, () => {
      seenDuringRequest = tracker.count();
      return of(new HttpResponse({ status: 200 }));
    });

    (result as ReturnType<typeof of>).subscribe();

    expect(seenDuringRequest).toBe(0);
  });

  it('passes the request through unchanged', () => {
    const req = new HttpRequest('POST', 'http://api/figure-instances/i1/assignments', { a: 1 });
    const next = vi.fn().mockReturnValue(of(new HttpResponse({ status: 200 })));
    const result = run(req, next);
    (result as ReturnType<typeof of>).subscribe();

    expect(next).toHaveBeenCalledWith(req);
  });
});
