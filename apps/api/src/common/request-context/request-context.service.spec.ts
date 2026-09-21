import { RequestContextService } from './request-context.service';

describe('RequestContextService', () => {
  let service: RequestContextService;

  beforeEach(() => {
    service = new RequestContextService();
  });

  it('returns undefined when read outside of any run()', () => {
    expect(service.get()).toBeUndefined();
  });

  it('returns the store while inside run()', () => {
    service.run({ clientId: 'tab-1' }, () => {
      expect(service.get()).toEqual({ clientId: 'tab-1' });
    });
  });

  it('propagates the store across an async continuation, not just the synchronous call', async () => {
    let seenInsideAsync: { clientId: string | null } | undefined;

    await service.run({ clientId: 'tab-1' }, async () => {
      await Promise.resolve();
      seenInsideAsync = service.get();
    });

    expect(seenInsideAsync).toEqual({ clientId: 'tab-1' });
  });

  it('isolates concurrent runs from each other', async () => {
    const seen: (string | null | undefined)[] = [];

    await Promise.all([
      service.run({ clientId: 'tab-a' }, async () => {
        await new Promise((r) => setTimeout(r, 10));
        seen.push(service.get()?.clientId);
      }),
      service.run({ clientId: 'tab-b' }, async () => {
        await new Promise((r) => setTimeout(r, 1));
        seen.push(service.get()?.clientId);
      }),
    ]);

    expect(seen.sort()).toEqual(['tab-a', 'tab-b']);
  });

  it('returns undefined again once run() has completed', async () => {
    await service.run({ clientId: 'tab-1' }, async () => Promise.resolve());

    expect(service.get()).toBeUndefined();
  });
});
