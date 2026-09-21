import { TestBed } from '@angular/core/testing';
import { PendingMutationsService } from './pending-mutations.service';

describe('PendingMutationsService', () => {
  let service: PendingMutationsService;

  beforeEach(() => {
    service = TestBed.inject(PendingMutationsService);
  });

  it('starts at zero', () => {
    expect(service.count()).toBe(0);
  });

  it('increments and decrements', () => {
    service.increment();
    service.increment();
    expect(service.count()).toBe(2);

    service.decrement();
    expect(service.count()).toBe(1);
  });

  it('never goes negative — an unexpected extra decrement must not corrupt the count', () => {
    service.decrement();
    expect(service.count()).toBe(0);
  });
});
