import { TestBed } from '@angular/core/testing';
import { ClientIdService } from './client-id.service';

describe('ClientIdService', () => {
  it('returns a non-empty id', () => {
    const service = TestBed.inject(ClientIdService);
    expect(service.id).toBeTruthy();
  });

  it('keeps returning the same id for the lifetime of the tab', () => {
    const service = TestBed.inject(ClientIdService);
    expect(service.id).toBe(service.id);
  });

  it('gives two separately-instantiated services different ids — one per tab, not shared', () => {
    const a = new ClientIdService();
    const b = new ClientIdService();
    expect(a.id).not.toBe(b.id);
  });
});
